/* =========================================================
   CLOUDINARY UPLOAD HELPER
   Ana amfani da wannan don turo VOICE NOTE da VIDEO
   (imgbb ba ya karban sauti/bidiyo, saboda haka mun
   yi amfani da Cloudinary a maimakon haka - kyauta ne,
   babu bukatar billing account).

   Cloud Name:     pelamtvq
   Upload Preset:  Arewa market   (Unsigned)
========================================================= */

const CLOUD_NAME = "pelamtvq";
const UPLOAD_PRESET = "Arewa market";

// "auto" yana gane da kansa ko hoto ne, audio, ko video
const UPLOAD_ENDPOINT =
  `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`;

/**
 * Turo file (audio ko video ko hoto) zuwa Cloudinary.
 * @param {Blob|File} file
 * @returns {Promise<{url:string, resourceType:string, duration:number|null}>}
 */
export async function uploadToCloudinary(file) {

  if (!file) {
    throw new Error("Babu file da aka zaba.");
  }

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
