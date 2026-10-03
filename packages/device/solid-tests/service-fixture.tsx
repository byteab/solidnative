/** @jsxImportSource @solid-native/platform/solid */
import { createSignal, type Accessor } from 'solid-js';
import { Show } from '@solid-native/platform/solid';
import {
  createObserved,
  createServiceToken,
  provideService,
  ServiceScope,
  useService,
  type ObservedSource,
} from '@solid-native/device/solid';

const sourceToken = createServiceToken<ObservedSource<number>>('sample source', () => {
  throw new Error('The sample source must be provided.');
});
const sampleToken = createServiceToken('sample', () => createObserved(useService(sourceToken), -1));

function Readout(props: { id: string }) {
  const sample = useService(sampleToken);
  return <text testID={props.id}>{sample()}</text>;
}

export function serviceFixture(source: ObservedSource<number>, inner: ObservedSource<number>) {
  const [visible, setVisible] = createSignal(false);
  let rootSample: Accessor<number> | undefined;
  function Capture() {
    rootSample = useService(sampleToken);
    return <Readout id="root-b" />;
  }
  return {
    setVisible,
    sample: () => rootSample?.(),
    render: () => (
      <ServiceScope services={[provideService(sourceToken, () => source)]}>
        <view>
          <Readout id="root-a" />
          <Capture />
          <Show when={visible()}>
            <ServiceScope
              services={[
                provideService(sourceToken, () => inner),
                provideService(sampleToken, sampleToken.create),
              ]}
            >
              <Readout id="inner" />
            </ServiceScope>
          </Show>
        </view>
      </ServiceScope>
    ),
  };
}
