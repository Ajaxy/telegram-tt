/* eslint-disable no-null/no-null */
// TODO delete file
export const readTemplate = (template: any, data: any = { items: {} }) => {
  for (const [key, value] of Object.entries(template)) {
    data.items[key] = {
      index: key,
      canMove: true,
      isFolder: value !== null,
      children: value !== null ? Object.keys(value as object) : undefined,
      data: key,
      canRename: true,
    };

    if (value !== null) {
      readTemplate(value, data);
    }
  }
  return data;
};

const shortTreeTemplate = {
  root: {
    container: {
      item0: null,
      item1: null,
      item2: null,
      item3: {
        inner0: null,
        inner1: null,
        inner2: null,
        inner3: null,
      },
      item4: null,
      item5: null,
    },
  },
};

const longTreeTemplate = {
  root: {
    Fruit: {
      Apple: null,
      Orange: null,
      Lemon: null,
      Berries: {
        Strawberry: null,
        Blueberry: null,
      },
      Banana: null,
    },
    Meals: {
      America: {
        SmashBurger: null,
        Chowder: null,
        Ravioli: null,
        MacAndCheese: null,
        Brownies: null,
      },
      Europe: {
        Risotto: null,
        Spaghetti: null,
        Pizza: null,
        Weisswurst: null,
        Spargel: null,
      },
      Asia: {
        Curry: null,
        PadThai: null,
        Jiaozi: null,
        Sushi: null,
      },
      Australia: {
        PotatoWedges: null,
        PokeBowl: null,
        LemonCurd: null,
        KumaraFries: null,
      },
    },
    Desserts: {
      Cookies: null,
      IceCream: null,
    },
    Drinks: {
      PinaColada: null,
      Cola: null,
      Juice: null,
    },
  },
};

export const longTree = readTemplate(longTreeTemplate);
export const shortTree = readTemplate(shortTreeTemplate);
