// MIT License
// Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others

function svg(content: string, attrs = `viewBox="0 0 40 40"`) {
  return `url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${encodeURIComponent(
    content
  )}</svg>')`;
}

export function underline(color: string) {
  return svg(
    `<path d="m0 2.5 l2 -1.5 l1 0 l2 1.5 l1 0" stroke="${color}" fill="none" stroke-width=".7"/>`,
    `width="6" height="3"`
  );
}
