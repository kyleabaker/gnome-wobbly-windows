import Meta from 'gi://Meta';

export const getMaximizedFlags = (win) => {
  let flags = 0;
  if (win.maximized_horizontally) flags |= Meta.MaximizeFlags.HORIZONTAL;
  if (win.maximized_vertically) flags |= Meta.MaximizeFlags.VERTICAL;
  return flags;
};
