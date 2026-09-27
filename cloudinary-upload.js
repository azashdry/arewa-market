/* =========================================================
   CLOUDINARY UPLOAD HELPER
   Ana amfani da wannan don turo VOICE NOTE da VIDEO
   (imgbb ba ya karban sauti/bidiyo, saboda haka mun
   yi amfani da Cloudinary a maimakon haka - kyauta ne,
   babu bukatar billing account).

   Cloud Name:     pelamtvq
   Upload Preset:  Arewa market   (Unsigned)

   ---------------------------------------------------------
   SABON ABU: An kara IYAKA (limits) domin kada Cloudinary
   FREE PLAN credits (25 kyauta/wata) su kare da sauri:

     - Video:  max 20 MB   da max dakika 60
     - Audio (voice note): max 5 MB  da max dakika 2 (120s)

   Idan file ya wuce wadannan, za a hana upload din kafin
   ma a tura shi zuwa Cloudinary - wannan yana ceton
   credits din ka.
========================================================= */

const CLOUD_NAME = "pelamtvq";
const UPLOAD_PRESET = "Arewa market";

// "auto" yana gane da kansa ko hoto ne, audio, ko video
const UPLOAD_ENDPOINT =
  `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`;

// ---------- IYAKOKI (LIMITS) - GYARA ANAN IDAN KANA SO ----------
const LIMITS = {
  video: {
    maxSizeMB: 20,
    maxDurationSeconds: 60
  },
  audio: {
    maxSizeMB: 5,
    maxDurationSeconds: 120
  }
};
// ------------------------------------------------------------------

/**
 * Gane irin file ne: "video", "audio", ko "other"
 */
function getMediaCategory(file) {
  if (file.type && file.type.startsWith("video/")) return "video";
  if (file.type && file.type.startsWith("audio/")) return "audio";
  return "other";
}

/**
 * Duba tsawon lokacin (duration) na video/audio file KAFIN a tura shi,
 * ta hanyar loda shi na dan lokaci a browser (ba a tura komai zuwa
 * Cloudinary a wannan mataki ba, kyauta ne kuma cikin sauri).
 *
 * @param {File} file
 * @param {"video"|"audio"} category
 * @returns {Promise<number>} tsawon lokaci a seconds
 */
function getMediaDuration(file, category) {
  return new Promise((resolve, reject) => {
    const el = document.createElement(category); // <video> ko <audio>
    el.preload = "metadata";

    const objectUrl = URL.createObjectURL(file);
    el.src = objectUrl;

    const cleanup = () => URL.revokeObjectURL(objectUrl);

    el.onloadedmetadata = () => {
      cleanup();
      resolve(el.duration);
    };

    el.onerror = () => {
      cleanup();
      // Idan ba a iya karanta duration ba, kar a toshe user - kawai
      // mu ci gaba ba tare da wannan gwajin ba.
      resolve(null);
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
        `File ${category === "video" ? "bidiyo" : "sauti"} din ya yi girma sosai ` +
        `(${sizeMB.toFixed(1)}MB). Iyakar da aka amince da ita shine ${limit.maxSizeMB}MB. ` +
        `Ka rage girman file din ka sake gwadawa.`
      );
    }
  }

  // ---------- 2) DUBA TSAWON LOKACI (duration) ----------
  if (limit && (category === "video" || category === "audio")) {
    const duration = await getMediaDuration(file, category);

    if (duration && duration > limit.maxDurationSeconds) {
      const maxMinutes = (limit.maxDurationSeconds / 60).toFixed(1);
      throw new Error(
        `${category === "video" ? "Bidiyon" : "Saƙon sautin"} ya yi tsawo sosai ` +
        `(dakika ${(duration / 60).toFixed(1)}). Iyakar da aka amince da ita shine ` +
        `dakika ${maxMinutes}. Ka gajarta shi ka sake gwadawa.`
      );
    }
  }

  // ---------- 3) TURA ZUWA CLOUDINARY ----------
  const formData = new FormData();

  formData.append(
    "file",
    file
  );

  formData.append(
    "upload_preset",
    UPLOAD_PRESET
  );

  const response =
    await fetch(
      UPLOAD_ENDPOINT,
      {
        method: "POST",
        body: formData
      }
    );

  const data =
    await response.json();

  if (!response.ok) {

    const msg =
      (data && data.error && data.error.message) ||
      "Ba a iya turo file din ba. Ka sake gwadawa.";

    throw new Error(msg);

  }

  return {
    url: data.secure_url,
    resourceType: data.resource_type,
    duration: data.duration || null
  };

}
