import { validateFiles } from '../../../../util/files';

export default async function getFilesFromDataTransferItems(dataTransferItems: DataTransferItemList) {
  const files: File[] = [];

  function traverseFileTreePromise(entry: FileSystemEntry | File, item: DataTransferItem) {
    return new Promise((resolve) => {
      if (entry instanceof File) {
        files.push(entry);
        resolve(entry);
      } else if (entry.isFile) {
        const itemFile = item.getAsFile();
        (entry as FileSystemFileEntry).file((file) => {
          files.push(file);
          resolve(file);
        }, () => {
          // iOS Safari throws an error "NotFoundError: Path does not exist" for files from the clipboard
          // https://stackoverflow.com/a/50059309
          if (itemFile) {
            files.push(itemFile);
          }
          resolve(itemFile);
        });
      } else if (entry.isDirectory) {
        const dirReader = (entry as FileSystemDirectoryEntry).createReader();
        dirReader.readEntries((entries) => {
          const entriesPromises = [];
          for (let i = 0; i < entries.length; i++) {
            entriesPromises.push(traverseFileTreePromise(entries[i], item));
          }
          resolve(Promise.all(entriesPromises));
        });
      }
    });
  }

  const entriesPromises = [];
  for (let i = 0; i < dataTransferItems.length; i++) {
    const item = dataTransferItems[i];
    if (item.kind === 'file') {
      const entry = item.webkitGetAsEntry() || item.getAsFile();
      if (entry) {
        entriesPromises.push(traverseFileTreePromise(entry, item));
      }
    }
  }

  await Promise.all(entriesPromises);

  return validateFiles(files);
}
