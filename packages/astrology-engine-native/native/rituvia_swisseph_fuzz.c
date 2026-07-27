#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define RITUVIA_FUZZING 1
#define main rituvia_bridge_main
#include "rituvia_swisseph_bridge.c"
#undef main

static const char *fuzz_ephemeris_path = ".";

int LLVMFuzzerInitialize(int *argc, char ***argv) {
  (void)argc;
  (void)argv;
  const char *configured_path = getenv("RITUVIA_FUZZ_EPHE_PATH");
  if (configured_path != NULL && configured_path[0] != '\0') {
    fuzz_ephemeris_path = configured_path;
  }
  return 0;
}

static uint32_t read_u32(const uint8_t *data, size_t size, size_t offset) {
  uint32_t value = 0;
  for (size_t index = 0; index < 4; index += 1) {
    value <<= 8;
    if (offset + index < size) {
      value |= data[offset + index];
    }
  }
  return value;
}

int LLVMFuzzerTestOneInput(const uint8_t *data, size_t size) {
  if (size < 8) {
    return 0;
  }

  char fields[10][64] = {{0}};
  char *arguments[12] = {
      "rituvia-swisseph-fuzz",
      (char *)fuzz_ephemeris_path,
      fields[0],
      fields[1],
      fields[2],
      fields[3],
      fields[4],
      fields[5],
      fields[6],
      fields[7],
      fields[8],
      fields[9],
  };
  const unsigned int year = 1800U + read_u32(data, size, 2) % 400U;
  const unsigned int month = 1U + read_u32(data, size, 3) % 12U;
  const unsigned int day = 1U + read_u32(data, size, 4) % 28U;
  const unsigned int hour = read_u32(data, size, 5) % 24U;
  const unsigned int minute = read_u32(data, size, 6) % 60U;
  const unsigned int millisecond = read_u32(data, size, 7) % 60000U;
  const long long latitude = (long long)(read_u32(data, size, 8) % 180000001U) - 90000000LL;
  const long long longitude =
      (long long)(read_u32(data, size, 9) % 360000001U) - 180000000LL;
  const char house_systems[] = {'P', 'W', 'A'};

  (void)snprintf(fields[0], sizeof(fields[0]), "%u", year);
  (void)snprintf(fields[1], sizeof(fields[1]), "%u", month);
  (void)snprintf(fields[2], sizeof(fields[2]), "%u", day);
  (void)snprintf(fields[3], sizeof(fields[3]), "%u", hour);
  (void)snprintf(fields[4], sizeof(fields[4]), "%u", minute);
  (void)snprintf(fields[5], sizeof(fields[5]), "%u", millisecond);
  (void)snprintf(fields[6], sizeof(fields[6]), "%lld", latitude);
  (void)snprintf(fields[7], sizeof(fields[7]), "%lld", longitude);
  fields[8][0] = house_systems[data[0] % 3U];
  fields[8][1] = '\0';
  fields[9][0] = (char)('0' + data[1] % 2U);
  fields[9][1] = '\0';

  if ((data[0] & 1U) != 0U) {
    static const char alphabet[] = "0123456789+-._ABCDEFGHIJKLMNOPQRSTUVWXYZ ";
    const size_t field_index = data[1] % 10U;
    const size_t available = size - 2U;
    const size_t length = available < sizeof(fields[field_index]) - 1U
                              ? available
                              : sizeof(fields[field_index]) - 1U;
    for (size_t index = 0; index < length; index += 1) {
      fields[field_index][index] = alphabet[data[index + 2U] % (sizeof(alphabet) - 1U)];
    }
    fields[field_index][length] = '\0';
  }

  (void)rituvia_bridge_main(12, arguments);
  return 0;
}
