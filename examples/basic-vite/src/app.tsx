import { useState } from "react";
import archiveBoxArrowDownIconHref from "./archive-box-arrow-down.svg";

export const App = () => {
  const [count, setCount] = useState(0);

  return (
    <div>
      <div>
        <svg width="100" height="100" aria-hidden>
          <use href={archiveBoxArrowDownIconHref} />
        </svg>
      </div>
      <button onClick={() => setCount((old) => old + 1)}>
        count is {count}
      </button>
    </div>
  );
};
