import useShowTransition, {
  type HookParams,
  type HookParamsWithShouldRender,
  type HookResult,
  type HookResultWithShouldRender,
} from './useShowTransition';

type HookParamsWithMediaData<RefType extends HTMLElement> = Omit<HookParams<RefType>, 'isOpen'> & {
  hasMediaData: boolean;
};
type HookParamsWithMediaDataAndShouldRender<RefType extends HTMLElement>
  = Omit<HookParamsWithShouldRender<RefType>, 'isOpen'> & {
    hasMediaData: boolean;
  };

export default function useMediaTransition<RefType extends HTMLElement = HTMLDivElement>(
  params: HookParamsWithMediaData<RefType>,
): HookResult<RefType>;
export default function useMediaTransition<RefType extends HTMLElement = HTMLDivElement>(
  params: HookParamsWithMediaDataAndShouldRender<RefType>,
): HookResultWithShouldRender<RefType>;
export default function useMediaTransition<RefType extends HTMLElement = HTMLDivElement>(
  params: HookParamsWithMediaData<RefType> | HookParamsWithMediaDataAndShouldRender<RefType>,
): HookResult<RefType> | HookResultWithShouldRender<RefType> {
  const result = useShowTransition<RefType>({
    isOpen: params.hasMediaData,
    noMountTransition: params.hasMediaData,
    className: 'slow',
    ...params,
  } as HookParams<RefType>);

  return result;
}
