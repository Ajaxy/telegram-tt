const generateIdFor = (store: AnyLiteral) => {
  let id;

  do {
    id = String(Math.random()).replace('0.', 'id');
  } while (store.hasOwnProperty(id));

  return id;
};

export default generateIdFor;
