export default async function getFilesFromDataTransferItems(dataTransferItems: DataTransferItemList) {
  const files: File[] = [];

  function traverseFileTreePromise(entry: FileSystemEntry | File, item: DataTransferItem) {
    return new Promise(resolve => {
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
        let dirReader = (entry as FileSystemDirectoryEntry).createReader();
        dirReader.readEntries((entries) => {
          let entriesPromises = [];
          for (let entr of entries) {
            entriesPromises.push(traverseFileTreePromise(entr, item));
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
        entriesPromises.push(traverseFileTreePromise(entry, item));
      }
    }
  }

  await Promise.all(entriesPromises);

  return files;
}

