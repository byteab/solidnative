/** @jsxImportSource @solid-native/platform/solid */
import { createMemo, createSignal } from 'solid-js';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from '@solid-native/components/solid';
import { useService } from '@solid-native/device/solid';
import { For, Show, setNativeStyleHost, withNativeStyles } from '@solid-native/platform/solid';
import { useNavigation } from '@solid-native/router/solid';
import {
  OPTIONS,
  Trip,
  fare,
  formatFare,
  searchPlaces,
  type Place,
  type RideOption,
} from './ride-model.solid.ts';
import sheet from './ride-sheet.native.css';

export function RideSheet() {
  const trip = useService(Trip),
    nav = useNavigation();
  const options = OPTIONS,
    stack = { gap: 10, paddingBottom: 24 };
  const [query, setQuery] = createSignal('');
  const places = createMemo(() => searchPlaces(query())),
    distance = () => `${trip.km().toFixed(1)} km from King's Cross`;
  const price = (option: RideOption) => formatFare(fare(option, trip.km()));
  const choose = (place: Place) => {
    setQuery('');
    trip.choose(place);
  };
  const finish = () => {
    trip.cancel();
    void nav.back();
  };
  return withNativeStyles(sheet, () => (
    <view style={{ flex: 1 }} ref={(node) => setNativeStyleHost(node, sheet)}>
      <View class="sheet">
        <Show when={trip.stage() === 'idle'}>
          <Text class="heading">{'Where to?'}</Text>
          <TextInput
            placeholder="Search destinations"
            accessibilityLabel="Search destinations"
            class="field"
            autoCorrect={false}
            value={query()}
            onValueChange={(event) => {
              setQuery(event);
            }}
          ></TextInput>
          <ScrollView keyboardShouldPersistTaps="handled" class="places">
            <For
              each={places()}
              fallback={
                <>
                  <Text class="hint">{'No places match.'}</Text>
                </>
              }
            >
              {(place) => (
                <>
                  <Pressable
                    accessibilityRole="button"
                    class="place"
                    accessibilityLabel={place.name + ', ' + place.area}
                    onPress={() => {
                      choose(place);
                    }}
                  >
                    <View class="pin">
                      <Text class="pin-glyph">{place.name[0]}</Text>
                    </View>
                    <View class="place-text">
                      <Text class="place-name">{place.name}</Text>
                      <Text class="place-area">{place.area}</Text>
                    </View>
                  </Pressable>
                </>
              )}
            </For>
          </ScrollView>
        </Show>
        <Show when={trip.stage() === 'choosing'}>
          <ScrollView class="places" contentContainerStyle={stack}>
            <Text class="heading">{trip.destination()?.name}</Text>
            <Text class="hint">{distance()}</Text>
            <For each={options}>
              {(option) => (
                <>
                  <Pressable
                    accessibilityRole="radio"
                    class={option.id === trip.option().id ? 'option chosen' : 'option'}
                    accessibilityState={{ checked: option.id === trip.option().id }}
                    accessibilityLabel={option.name + ', ' + price(option)}
                    onPress={() => {
                      trip.setOption(option);
                    }}
                  >
                    <View class="grow">
                      <Text class="option-name">{option.name}</Text>
                      <Text class="hint">
                        {option.seats}
                        {' seats, '}
                        {option.eta}
                        {' min away'}
                      </Text>
                    </View>
                    <Text class="price">{price(option)}</Text>
                  </Pressable>
                </>
              )}
            </For>
            <Pressable
              accessibilityRole="button"
              class="request"
              onPress={() => {
                trip.request();
              }}
            >
              <Text class="request-label">
                {'Request '}
                {trip.option().name}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              class="quiet"
              onPress={() => {
                trip.cancel();
              }}
            >
              <Text class="quiet-label">{'Change destination'}</Text>
            </Pressable>
          </ScrollView>
        </Show>
        <Show when={trip.stage() === 'finding'}>
          <Text class="heading">{'Finding a driver'}</Text>
          <View class="pulse"></View>
          <ActivityIndicator size="large"></ActivityIndicator>
          <Pressable
            accessibilityRole="button"
            class="quiet"
            onPress={() => {
              trip.cancel();
            }}
          >
            <Text class="danger-label">{'Cancel'}</Text>
          </Pressable>
        </Show>
        <Show when={trip.stage() === 'arriving'}>
          <Show when={trip.driver()}>
            {(driver) => (
              <>
                <Text class="heading">
                  {driver().name}
                  {' is on the way'}
                </Text>
                <View class="driver">
                  <View class="avatar">
                    <Text class="avatar-initial">{driver().name[0]}</Text>
                  </View>
                  <View class="grow">
                    <Text class="option-name">{driver().car}</Text>
                    <Text class="hint">
                      {driver().plate}
                      {', arriving in '}
                      {trip.option().eta}
                      {' min'}
                    </Text>
                  </View>
                </View>
              </>
            )}
          </Show>
          <Pressable
            accessibilityRole="button"
            class="quiet"
            onPress={() => {
              finish();
            }}
          >
            <Text class="danger-label">{'Cancel ride'}</Text>
          </Pressable>
        </Show>
      </View>
    </view>
  ));
}
