(function () {
  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getScope(element) {
    return element.closest(".inline-related") || element.closest("form") || document;
  }

  function findFieldInput(scope, fieldName) {
    const selectors = [
      `[name$='-${fieldName}']`,
      `[name='${fieldName}']`,
      `#id_${fieldName}`,
    ];

    for (const selector of selectors) {
      const el = scope.querySelector(selector);
      if (el) return el;
    }
    return null;
  }

  function findFieldContainer(scope, fieldName) {
    const byClass = scope.querySelector(`.field-${fieldName}`);
    if (byClass) return byClass;

    const input = findFieldInput(scope, fieldName);
    if (!input) return null;

    return input.closest(".form-row, .fieldBox, .form-group, td, .aligned") || input.parentElement;
  }

  function setVisible(container, visible) {
    if (!container) return;
    container.style.display = visible ? "" : "none";
    container.setAttribute("aria-hidden", String(!visible));
  }

  function setFieldLabel(container, labelText) {
    if (!container) return;
    const label = container.querySelector("label");
    if (label) {
      label.textContent = labelText;
    }
  }

  function setHelpText(container, helpText) {
    if (!container) return;
    let help = container.querySelector(".help, .helptext");
    if (!help && helpText) {
      help = document.createElement("div");
      help.className = "help";
      container.appendChild(help);
    }
    if (help) {
      help.textContent = helpText || "";
    }
  }

  function detectKind(scope) {
    const hasFreeFields = Boolean(findFieldInput(scope, "text_body") && findFieldInput(scope, "file"));
    if (hasFreeFields) return "free";

    const hasPremiumFields = Boolean(
      findFieldInput(scope, "description") &&
      (findFieldInput(scope, "image") || findFieldInput(scope, "video"))
    );
    if (hasPremiumFields) return "premium";

    return null;
  }

  function getPreviewContainer(scope) {
    const previewField = findFieldContainer(scope, "live_preview");
    if (!previewField) return null;

    let body = previewField.querySelector(".js-live-preview-body");
    if (!body) {
      body = document.createElement("div");
      body.className = "js-live-preview-body";
      previewField.appendChild(body);
    }
    return body;
  }

  function renderTextPreview(title, body) {
    const safeTitle = escapeHtml(title || "Analysis");
    const safeBody = escapeHtml(body || "No text content available yet.");

    return (
      `<div class="content-preview-text">` +
      `<p class="content-preview-title">${safeTitle}</p>` +
      `<div class="content-preview-body">${safeBody.replace(/\n/g, "<br />")}</div>` +
      `</div>`
    );
  }

  function renderFileMeta(prefix, fileName) {
    const safeName = escapeHtml(fileName || "No file selected yet.");
    return `<div class="content-preview-file">${prefix} <strong>${safeName}</strong></div>`;
  }

  function renderImagePreview(url, fileName) {
    const safeUrl = escapeHtml(url);
    const safeName = escapeHtml(fileName || "Preview image");
    return (
      `<div class="content-preview-file">🖼️ <strong>${safeName}</strong></div>` +
      `<img src="${safeUrl}" alt="Image preview" style="max-height: 140px; border-radius: 10px; margin-top: 8px;" />`
    );
  }

  function renderVideoPreview(url, fileName) {
    const safeUrl = escapeHtml(url);
    const safeName = escapeHtml(fileName || "Preview video");
    return (
      `<div class="content-preview-file">🎬 <strong>${safeName}</strong></div>` +
      `<video src="${safeUrl}" controls controlsList="nodownload" style="max-height: 180px; border-radius: 10px; margin-top: 8px;"></video>`
    );
  }

  function updateFreeUI(scope, contentType) {
    const textTitleField = findFieldContainer(scope, "text_title");
    const textBodyField = findFieldContainer(scope, "text_body");
    const fileField = findFieldContainer(scope, "file");

    const isText = contentType === "text";
    const isImage = contentType === "image";
    const isPdf = contentType === "pdf";

    setVisible(textTitleField, isText);
    setVisible(textBodyField, isText);
    setVisible(fileField, isImage || isPdf);

    if (fileField) {
      if (isImage) {
        setFieldLabel(fileField, "Upload Image Analysis");
        setHelpText(fileField, "Upload GL team screenshots or analysis images.");
      } else if (isPdf) {
        setFieldLabel(fileField, "Upload PDF Report");
        setHelpText(fileField, "Upload match report PDF.");
      }
    }

    const preview = getPreviewContainer(scope);
    if (!preview) return;

    const textTitleInput = findFieldInput(scope, "text_title");
    const textBodyInput = findFieldInput(scope, "text_body");
    const fileInput = findFieldInput(scope, "file");

    if (isText) {
      preview.innerHTML = renderTextPreview(
        textTitleInput ? textTitleInput.value : "Analysis",
        textBodyInput ? textBodyInput.value : ""
      );
      return;
    }

    const selectedFile = fileInput && fileInput.files ? fileInput.files[0] : null;

    if (!selectedFile) {
      preview.innerHTML = isImage
        ? renderFileMeta("🖼️", "No image selected yet.")
        : renderFileMeta("📄", "No PDF selected yet.");
      return;
    }

    if (isImage) {
      const url = URL.createObjectURL(selectedFile);
      preview.innerHTML = renderImagePreview(url, selectedFile.name);
      return;
    }

    preview.innerHTML = renderFileMeta("📄", selectedFile.name);
  }

  function updatePremiumUI(scope, contentType) {
    const titleField = findFieldContainer(scope, "title");
    const descriptionField = findFieldContainer(scope, "description");
    const imageField = findFieldContainer(scope, "image");
    const videoField = findFieldContainer(scope, "video");

    const isText = contentType === "text";
    const isImage = contentType === "image";
    const isVideo = contentType === "video";

    setVisible(titleField, isText);
    setVisible(descriptionField, isText);
    setVisible(imageField, isImage);
    setVisible(videoField, isVideo);

    const preview = getPreviewContainer(scope);
    if (!preview) return;

    const titleInput = findFieldInput(scope, "title");
    const descriptionInput = findFieldInput(scope, "description");
    const imageInput = findFieldInput(scope, "image");
    const videoInput = findFieldInput(scope, "video");

    if (isText) {
      preview.innerHTML = renderTextPreview(
        titleInput ? titleInput.value : "Analysis",
        descriptionInput ? descriptionInput.value : ""
      );
      return;
    }

    if (isImage) {
      const selectedImage = imageInput && imageInput.files ? imageInput.files[0] : null;
      if (!selectedImage) {
        preview.innerHTML = renderFileMeta("🖼️", "No image selected yet.");
        return;
      }
      const imageUrl = URL.createObjectURL(selectedImage);
      preview.innerHTML = renderImagePreview(imageUrl, selectedImage.name);
      return;
    }

    const selectedVideo = videoInput && videoInput.files ? videoInput.files[0] : null;
    if (!selectedVideo) {
      preview.innerHTML = renderFileMeta("🎬", "No video selected yet.");
      return;
    }
    const videoUrl = URL.createObjectURL(selectedVideo);
    preview.innerHTML = renderVideoPreview(videoUrl, selectedVideo.name);
  }

  function updateScope(scope) {
    const select = findFieldInput(scope, "content_type");
    if (!select) return;

    const kind = detectKind(scope);
    if (!kind) return;

    const selected = (select.value || "").toLowerCase();
    if (kind === "free") {
      updateFreeUI(scope, selected || "pdf");
      return;
    }

    updatePremiumUI(scope, selected || "text");
  }

  function updateAll() {
    const selects = Array.from(document.querySelectorAll("select[name$='content_type'], select[id$='content_type']"));
    selects.forEach((select) => {
      updateScope(getScope(select));
    });
  }

  function bindEvents() {
    document.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      if (
        target.matches("select[name$='content_type'], select[id$='content_type']") ||
        target.matches("textarea[name$='text_body'], textarea[name='text_body']") ||
        target.matches("textarea[name$='description'], textarea[name='description']") ||
        target.matches("input[name$='text_title'], input[name='text_title']") ||
        target.matches("input[name$='title'], input[name='title']") ||
        target.matches("input[type='file']")
      ) {
        updateScope(getScope(target));
      }
    });

    document.addEventListener("input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      if (
        target.matches("textarea[name$='text_body'], textarea[name='text_body']") ||
        target.matches("textarea[name$='description'], textarea[name='description']") ||
        target.matches("input[name$='text_title'], input[name='text_title']") ||
        target.matches("input[name$='title'], input[name='title']")
      ) {
        updateScope(getScope(target));
      }
    });

    if (window.django && window.django.jQuery) {
      window.django.jQuery(document).on("formset:added", function (_event, $row) {
        const rowElement = $row && $row[0] ? $row[0] : document;
        window.setTimeout(() => {
          updateScope(getScope(rowElement));
          updateAll();
        }, 0);
      });
    }

    document.addEventListener("formset:added", (event) => {
      const target = event.target instanceof HTMLElement ? event.target : document.body;
      window.setTimeout(() => {
        updateScope(getScope(target));
        updateAll();
      }, 0);
    });
  }

  function init() {
    bindEvents();
    updateAll();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
