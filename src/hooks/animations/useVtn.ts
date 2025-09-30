import buildStyle from '../../util/buildStyle';
import useLastCallback from '../useLastCallback';
import useUniqueId from '../useUniqueId';

const VTN_PROPERTY_NAME = '--_vtn';

CSS.registerProperty?.({
  name: VTN_PROPERTY_NAME,
  syntax: '*',
  inherits: false,
});

export function useVtn(uniqueId?: string) {
  const fallbackId = useUniqueId();

  // Pass `true` to use the same class name as the name parameter
  const createVtnStyle = useLastCallback((name: string, vtClass?: string | boolean) => {
    const vtClassString = vtClass === true ? name : (vtClass || undefined);
    return buildStyle(
      `${VTN_PROPERTY_NAME}: vtn-${name}-${uniqueId || fallbackId}`,
      vtClassString && `view-transition-class: ${vtClassString}`,
    );
  });

  return {
    createVtnStyle,
  };
}
