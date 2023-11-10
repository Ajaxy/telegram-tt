import { LeftColumnContent } from '../../../types';

export const selectNewChannel = (onContentChange: (content: LeftColumnContent) => void) => {
  return () => {
    onContentChange(LeftColumnContent.NewChannelStep1);
  };
};

export const selectNewGroup = (onContentChange: (content: LeftColumnContent) => void) => {
  return () => {
    onContentChange(LeftColumnContent.NewGroupStep1);
  };
};
