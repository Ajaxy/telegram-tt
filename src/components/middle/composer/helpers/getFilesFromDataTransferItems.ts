export default async function getFilesFromDataTransferItems(dataTransferItems: DataTransferItemList) {
  const files: File[] = [];

  function traverseFileTreePromise(entry: FileSystemEntry | File) {
    return new Promise(resolve => {
      if (entry instanceof File) {
        files.push(entry);
        resolve(entry);
      } else if (entry.isFile) {
        (entry as FileSystemFileEntry).file((file) => {
          files.push(file);
          resolve(file);
        });
      } else if (entry.isDirectory) {
        let dirReader = (entry as FileSystemDirectoryEntry).createReader();
        dirReader.readEntries((entries) => {
          let entriesPromises = [];
          for (let entr of entries) {
            entriesPromises.push(traverseFileTreePromise(entr));
          }
          resolve(Promise.all(entriesPromises));
        });
      }
    });
  }

  let entriesPromises = [];
  for (let item of dataTransferItems) {
    if (item.kind === 'file') {
      const entry = item.webkitGetAsEntry() || item.getAsFile();
      if (entry) {
        entriesPromises.push(traverseFileTreePromise(entry));
      }
    }
  }

  await Promise.all(entriesPromises);

  return files;
}

