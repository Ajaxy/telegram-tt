// For some reason setting `document.title` to the same value
// causes increment of Chrome Dev Tools > Performance Monitor > DOM Nodes counter
export default function updatePageTitle(nextTitle: string) {
  if (document.title !== nextTitle) {
    document.title = nextTitle;
  }
}
