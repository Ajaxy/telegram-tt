
export const HistoryWrapper: {
  pushState(data: any): void;
  back(): void;
  states: any[];
  isHistoryChangedByUser: boolean;
} = {
  states: [],
  isHistoryChangedByUser: true,
  pushState(data: any) {
    this.states.push(data);

    window.history.pushState(data, '');
  },
  back() {
    this.isHistoryChangedByUser = false;
    window.history.back();
    this.states.pop();
  },
};
