/**
 * Folder path helpers for map32 asset libraries.
 */

/**
 * Create any missing folders in a slash-delimited path.
 *
 * Parameters:
 *   library: Asset library document.
 *   rawPath: Folder name or slash-delimited path.
 *   createId: Callback that returns a portable folder id.
 * Returns:
 *   The deepest folder in the path.
 */
export function ensureFolderPath(library, rawPath, createId) {
  const names = rawPath.split("/").map((part) => part.trim()).filter(Boolean);
  if (!names.length) {
    library.activeFolderId = library.folders[0].id;
    return library.folders[0];
  }
  let parentId = null;
  let folder = null;
  for (const name of names) {
    folder = findChildFolder(library, parentId, name);
    if (!folder) {
      folder = { id: createId(), name, parentId, tiles: [] };
      library.folders.push(folder);
    }
    parentId = folder.id;
  }
  library.activeFolderId = folder.id;
  return folder;
}

/**
 * Return all folders with display paths for dropdowns.
 *
 * Parameters:
 *   library: Asset library document.
 * Returns:
 *   Array of folders and path labels.
 */
export function folderPathOptions(library) {
  return library.folders.map((folder) => ({ folder, label: folderPath(library, folder) }));
}

/**
 * Build a display path for one folder.
 *
 * Parameters:
 *   library: Asset library document.
 *   folder: Folder to describe.
 * Returns:
 *   Slash-delimited folder path.
 */
export function folderPath(library, folder) {
  const names = [];
  let current = folder;
  while (current) {
    names.unshift(current.name);
    current = library.folders.find((item) => item.id === current.parentId);
  }
  return names.join("/");
}

/**
 * Find a folder by parent and display name.
 *
 * Parameters:
 *   library: Asset library document.
 *   parentId: Parent folder id, or null for root folders.
 *   name: Display folder name.
 * Returns:
 *   Matching folder, or undefined.
 */
function findChildFolder(library, parentId, name) {
  return library.folders.find((folder) =>
    (folder.parentId || null) === parentId && folder.name.toLowerCase() === name.toLowerCase());
}
