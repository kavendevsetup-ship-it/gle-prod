(function () {
  const TYPE_PDF = "pdf";
  const TYPE_IMAGE = "image";
  const TYPE_TEXT = "text";

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
      file: "file",
      textTitle: "text_title",
      textBody: "text_body",
    };

    const selectedType = (select.value || TYPE_PDF).toLowerCase();

    const baseId = select.id.endsWith("content_type")
      ? select.id.slice(0, -"content_type".length)
      : "id_";

    const fileInput = document.getElementById(`${baseId}${suffixMap.file}`);
    const textTitleInput = document.getElementById(`${baseId}${suffixMap.textTitle}`);
    const textBodyInput = document.getElementById(`${baseId}${suffixMap.textBody}`);

    const fileContainer = findFieldContainer(fileInput, suffixMap.file);
    const textTitleContainer = findFieldContainer(textTitleInput, suffixMap.textTitle);
    const textBodyContainer = findFieldContainer(textBodyInput, suffixMap.textBody);

    const showFile = selectedType === TYPE_PDF || selectedType === TYPE_IMAGE;
    const showText = selectedType === TYPE_TEXT;

    setVisible(fileContainer, showFile);
    setVisible(textTitleContainer, showText);
    setVisible(textBodyContainer, showText);
  }

  function bind() {
    const selectors = Array.from(document.querySelectorAll("select[id$='content_type']"));
    selectors.forEach((select) => {
      const hasFreeFields = Boolean(
        document.getElementById(
          select.id.endsWith("content_type")
            ? `${select.id.slice(0, -"content_type".length)}text_body`
            : "id_text_body"
        )
      );

      if (!hasFreeFields) return;

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
