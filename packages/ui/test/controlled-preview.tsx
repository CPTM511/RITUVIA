import { useState } from "react";
import { createRoot } from "react-dom/client";

import { TextField, createUiControlId, createUiControlName } from "../src/index.js";

const root = document.querySelector("#controlled-root");
if (!(root instanceof HTMLElement)) {
  throw new TypeError("The controlled writing-system preview root is unavailable.");
}

const documentLocale = document.documentElement.lang;
const hindi = documentLocale === "hi";

const ControlledWritingSystemField = () => {
  const [renderRevision, setRenderRevision] = useState(0);
  const [value, setValue] = useState("");

  return (
    <section
      data-controlled-ready="true"
      data-render-revision={renderRevision}
      lang={hindi ? "hi" : "ja"}
    >
      <TextField
        autoComplete="name"
        description={
          hindi
            ? "यह नियंत्रित कृत्रिम क्षेत्र React composition व्यवहार की जाँच करता है।"
            : "この制御された合成欄で React の変換中入力を確認します。"
        }
        id={createUiControlId("controlled-name")}
        label={hindi ? "नियंत्रित कृत्रिम नाम" : "制御された合成氏名"}
        name={createUiControlName("preview.controlled-name")}
        onValueChange={setValue}
        value={value}
      />
      <button
        id="controlled-rerender"
        onClick={() => setRenderRevision((current) => current + 1)}
        type="button"
      >
        {hindi ? "पुनः रेंडर जाँच" : "再レンダー確認"}
      </button>
      <output data-controlled-value="true" htmlFor="controlled-name">
        {value}
      </output>
    </section>
  );
};

createRoot(root).render(<ControlledWritingSystemField />);
