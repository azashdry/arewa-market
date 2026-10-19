/* =========================================================
   CLOUDINARY UPLOAD HELPER
   Ana amfani da wannan don turo VOICE NOTE da VIDEO
   (imgbb ba ya karban sauti/bidiyo, saboda haka mun
   yi amfani da Cloudinary a maimakon haka - kyauta ne,
   babu bukatar billing account).

   Cloud Name:     pelamtvq
   Upload Preset:  Arewa market   (Unsigned)

   ---------------------------------------------------------
   IYAKA (limits) domin kada Cloudinary FREE PLAN credits
   (25 kyauta/wata) su kare da sauri:

     - Video:  max 50 MB   da max minti 5 (300s)
     - Audio (voice note): max 15 MB  da max minti 5 (300s)

   Idan file ya wuce wadannan, za a hana upload din kafin
   ma a tura shi zuwa Cloudinary - wannan yana ceton
   credits din ka.

   GYARA: An magance matsalar "minti Infinity". Sautin da aka
   dauka a browser (MediaRecorder/webm) yakan bada
   duration = Infinity. Yanzu ana tilasta browser ya lissafa
   tsawon sautin da gaske, kuma idan ba a iya sani ba, ba a
   toshe user.
========================================================= */

const CLOUD_NAME = "pelamtvq";
const UPLOAD_PRESET = "Arewa market";

// "auto" yana gane da kansa ko hoto ne, audio, ko video
const UPLOAD_ENDPOINT =
  `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`;

// Takardu (PDF, Word, Excel, ZIP...) ana tura su a "raw" - hakan
// yana kauce wa takaitawar PDF ta Cloudinary a free plan.
const RAW_ENDPOINT =
  `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/raw/upload`;

// ---------- IYAKOKI (LIMITS) - GYARA ANAN IDAN KANA SO ----------
const LIMITS = {
  image: {
    maxSizeMB: 10
  },
  document: {
    maxSizeMB: 20
  },
  video: {
    maxSizeMB: 50,
    maxDurationSeconds: 300   // minti 5
  },
  audio: {
    maxSizeMB: 15,
    maxDurationSeconds: 300   // minti 5
  }
};
// ------------------------------------------------------------------

/**
 * Gane irin file ne: "video", "audio", ko "other"
 */
function getMediaCategory(file) {
  if (file.type && file.type.startsWith("video/")) return "video";
  if (file.type && file.type.startsWith("audio/")) return "audio";
  if (file.type && file.type.startsWith("image/")) return "image";
  return "document";
}

/**
 * Duba tsawon lokacin (duration) na video/audio file KAFIN a tura shi,
 * ta hanyar loda shi na dan lokaci a browser (ba a tura komai zuwa
 * Cloudinary a wannan mataki ba, kyauta ne kuma cikin sauri).
 *
 * Yana magance matsalar duration = Infinity (na webm recordings)
 * ta hanyar tsallake zuwa karshen file don browser ya lissafa tsawon.
 *
 * @param {File} file
 * @param {"video"|"audio"} category
 * @returns {Promise<number|null>} tsawon lokaci a seconds, ko null
 */
function getMediaDuration(file, category) {
  return new Promise((resolve) => {
    const el = document.createElement(category); // <video> ko <audio>
    el.preload = "metadata";

    const objectUrl = URL.createObjectURL(file);
    el.src = objectUrl;

    let finished = false;
    const done = (value) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      URL.revokeObjectURL(objectUrl);
      resolve(value);
    };

    // Idan an dauki lokaci mai tsawo ba tare da amsa ba, ci gaba
    const timer = setTimeout(() => done(null), 5000);

    el.onloadedmetadata = () => {
      if (el.duration === Infinity || isNaN(el.duration)) {
        // Dabara: tsallaka zuwa karshe don browser ya lissafa tsawon
        el.ontimeupdate = () => {
          el.ontimeupdate = null;
          done(isFinite(el.duration) ? el.duration : null);
        };
        el.currentTime = 1e101;
      } else {
        done(el.duration);
      }
    };

    el.onerror = () => {
      // Idan ba a iya karanta duration ba, kar a toshe user - kawai
      // mu ci gaba ba tare da wannan gwajin ba.
      done(null);
    };
  });
}

/**
 * Turo file (audio ko video ko hoto) zuwa Cloudinary.
 * Yana FARKO duba girman file da tsawon lokacinsa, sannan sai
 * ya tura shi zuwa Cloudinary idan ya cika sharudda.
 *
 * @param {Blob|File} file
 * @returns {Promise<{url:string, resourceType:string, duration:number|null}>}
 */
export async function uploadToCloudinary(file) {

  if (!file) {
    throw new Error("Babu file da aka zaba.");
  }

  const category = getMediaCategory(file);
  const limit = LIMITS[category];

  // ---------- 1) DUBA GIRMAN FILE (size) ----------
  if (limit) {
    const sizeMB = file.size / (1024 * 1024);

    if (sizeMB > limit.maxSizeMB) {
      throw new Error(
        `File ${{ video: "bidiyo", audio: "sauti", image: "hoton", document: "takardar" }[category]} din ya yi girma sosai ` +
        `(${sizeMB.toFixed(1)}MB). Iyakar da aka amince da ita shine ${limit.maxSizeMB}MB. ` +
        `Ka rage girman file din ka sake gwadawa.`
      );
    }
  }

  // ---------- 2) DUBA TSAWON LOKACI (duration) ----------
  if (limit && (category === "video" || category === "audio")) {
    const duration = await getMediaDuration(file, category);

    // isFinite yana hana kuskuren "Infinity"
    if (
      duration &&
      isFinite(duration) &&
      duration > limit.maxDurationSeconds
    ) {
      const maxMinutes = Math.round(limit.maxDurationSeconds / 60);
      throw new Error(
        `${category === "video" ? "Bidiyon" : "Saƙon sautin"} ya yi tsawo sosai ` +
        `(minti ${(duration / 60).toFixed(1)}). Iyakar da aka amince da ita shine ` +
        `minti ${maxMinutes}. Ka gajarta shi ka sake gwadawa.`
      );
    }
  }

  // ---------- 3) TURA ZUWA CLOUDINARY ----------
  const formData = new FormData();

  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);

  const endpoint = category === "document" ? RAW_ENDPOINT : UPLOAD_ENDPOINT;

  const response = await fetch(endpoint, {
    method: "POST",
    body: formData
  });

  const data = await response.json();

  if (!response.ok) {
    const msg =
      (data && data.error && data.error.message) ||
      "Ba a iya turo file din ba. Ka sake gwadawa.";

    throw new Error(msg);
  }

  return {
    url: data.secure_url,
    resourceType: data.resource_type,
    duration: data.duration || null,
    bytes: data.bytes || file.size || null,
    name: file.name || null
  };

}
