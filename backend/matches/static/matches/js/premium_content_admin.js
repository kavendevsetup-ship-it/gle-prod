(function () {
  const TYPE_TEXT = "text";
  const TYPE_IMAGE = "image";
  const TYPE_VIDEO = "video";

  function findFieldContainer(input, fieldName) {
    if (!input) return null;

    const direct = input.closest(".form-row, .fieldBox, .form-group");
    if (direct) return direct;

    const byClass = document.querySelector(`.field-${fieldName}`);
    if (byClass) return byClass;

    return null;
  }

  function setVisible(container, visible) {
    if (!container) return;
    container.style.display = visible ? "" : "none";
  }

  function toggleForSelect(select) {
    const suffixMap = {
      title: "title",
      description: "description",
      image: "image",
      imagePreview: "image_preview",
      video: "video",
      videoPreview: "video_preview",
    };

    const selectedType = (select.value || TYPE_TEXT).toLowerCase();

    const baseId = select.id.endsWith("content_type")
      ? select.id.slice(0, -"content_type".length)
      : "id_";

    const titleInput = document.getElementById(`${baseId}${suffixMap.title}`);
    const descriptionInput = document.getElementById(`${baseId}${suffixMap.description}`);
    const imageInput = document.getElementById(`${baseId}${suffixMap.image}`);
    const imagePreviewInput = document.getElementById(`${baseId}${suffixMap.imagePreview}`);
    const videoInput = document.getElementById(`${baseId}${suffixMap.video}`);
    const videoPreviewInput = document.getElementById(`${baseId}${suffixMap.videoPreview}`);

    const titleContainer = findFieldContainer(titleInput, suffixMap.title);
    const descriptionContainer = findFieldContainer(descriptionInput, suffixMap.description);
    const imageContainer = findFieldContainer(imageInput, suffixMap.image);
    const imagePreviewContainer = findFieldContainer(imagePreviewInput, suffixMap.imagePreview);
    const videoContainer = findFieldContainer(videoInput, suffixMap.video);
    const videoPreviewContainer = findFieldContainer(videoPreviewInput, suffixMap.videoPreview);

    const showText = selectedType === TYPE_TEXT;
    const showImage = selectedType === TYPE_IMAGE;
    const showVideo = selectedType === TYPE_VIDEO;

    setVisible(titleContainer, showText);
    setVisible(descriptionContainer, showText);
    setVisible(imageContainer, showImage);
    setVisible(imagePreviewContainer, showImage);
    setVisible(videoContainer, showVideo);
    setVisible(videoPreviewContainer, showVideo);
  }

  function bind() {
    const selectors = Array.from(document.querySelectorAll("select[id$='content_type']"));
    selectors.forEach((select) => {
      const baseId = select.id.endsWith("content_type")
        ? select.id.slice(0, -"content_type".length)
        : "id_";

      const hasPremiumFields = Boolean(
        document.getElementById(`${baseId}description`) ||
        document.querySelector(".field-description")
      );

      if (!hasPremiumFields) return;

      toggleForSelect(select);
      select.addEventListener("change", () => toggleForSelect(select));
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
