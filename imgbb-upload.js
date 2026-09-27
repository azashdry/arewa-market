/* =========================================================
   IMGBB UPLOAD HELPER
   Ana amfani da wannan a maimakon Firebase Storage
   domin turo hotuna (saboda babu billing account).

   Yadda yake aiki:
   - User ya zabi hoto daga na'urarsa (file input)
   - Muna turashi zuwa imgbb ta amfani da API key
   - imgbb ta mayar da URL
   - Mun sanya wannan URL a cikin input din da yake
     akwai a form (misali #productImage), sannan mun
     "dispatch" wani "input" event domin duk wani code
     da yake sauraron wannan input (misali preview code)
     ya ci gaba da aiki kamar yadda yake yanzu, ba tare
     da an canza shi ba.
========================================================= */

const IMGBB_API_KEY = "dfaaa5e23758aefce7dbcf93a3edb304";
const IMGBB_ENDPOINT = "https://api.imgbb.com/1/upload";

/**
 * Turo file guda daya zuwa imgbb.
 * @param {File} file
 * @returns {Promise<string>} URL din hoton da ya dawo daga imgbb
 */
export async function uploadToImgbb(file) {

  if (!file) {
    throw new Error("Ba a zabi wani hoto ba.");
  }

  if (!file.type.startsWith("image/")) {
    throw new Error("Dole ne ka zabi hoto (image file).");
  }

  const formData = new FormData();
  formData.append("image", file);

  const response = await fetch(
    `${IMGBB_ENDPOINT}?key=${IMGBB_API_KEY}`,
    {
      method: "POST",
      body: formData
    }
  );

  const data = await response.json();

  if (!response.ok || !data.success) {
    const msg =
      (data && data.error && data.error.message) ||
      "Ba a iya turo hoton ba. Ka sake gwadawa.";
    throw new Error(msg);
  }

  return data.data.url;
}

/**
 * Haɗa wani file-input mai "zabi hoto" da wani URL-input
 * da ya riga ya kasance a form ɗinka, ba tare da canza
 * wani code na baya ba.
 *
 * @param {Object} opts
 * @param {string} opts.fileInputId  - id na <input type="file">
 * @param {string} opts.urlInputId   - id na <input type="url"> da yake akwai a form
 * @param {string} [opts.statusId]   - id na wani element (span/small) na nuna sakon "ana turawa..."
 * @param {Function} [opts.onStart]  - ana kira lokacin da upload ya FARA (misali domin toshe "Save" button)
 * @param {Function} [opts.onDone]   - ana kira lokacin da upload ya GAMA (ko yayi nasara ko a'a) domin buɗe "Save" button
 */
export function attachImgbbUploader({ fileInputId, urlInputId, statusId, onStart, onDone }) {

  const fileInput = document.getElementById(fileInputId);
  const urlInput = document.getElementById(urlInputId);
  const statusEl = statusId ? document.getElementById(statusId) : null;

  if (!fileInput || !urlInput) {
    console.warn(
      "attachImgbbUploader: ba a samu input(s) ba:",
      fileInputId,
      urlInputId
    );
    return;
  }

  fileInput.addEventListener("change", async () => {

    const file = fileInput.files && fileInput.files[0];
    if (!file) return;

    fileInput.disabled = true;

    // Muhimmi: mun toshe "Save" button (idan an bayar)
    // domin kada user ya danna Save kafin upload ya gama,
    // wanda zai sa a ajiye TSOHON URL a Firestore.
    if (typeof onStart === "function") {
      onStart();
    }

    if (statusEl) {
      statusEl.textContent = "⏳ Ana turo hoto...";
      statusEl.style.color = "#b8860b";
    }

    try {

      const url = await uploadToImgbb(file);

      urlInput.value = url;

      // Wannan zai tada duk wani "input" listener da yake
      // akwai a code din ka a yanzu (misali preview image),
      // ba tare da bukatar canza wani abu a wannan code ba.
      urlInput.dispatchEvent(
        new Event("input", { bubbles: true })
      );

      if (statusEl) {
        statusEl.textContent = "✅ An turo hoto cikin nasara";
        statusEl.style.color = "green";
      }

    } catch (err) {

      console.error("imgbb upload error:", err);

      if (statusEl) {
        statusEl.textContent = "❌ " + err.message;
        statusEl.style.color = "crimson";
      }

    } finally {
      fileInput.disabled = false;
      fileInput.value = "";

      if (typeof onDone === "function") {
        onDone();
      }
    }

  });
}
