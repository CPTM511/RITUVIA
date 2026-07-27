#include <errno.h>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "swephexp.h"

static int fail(const char *code) {
#ifdef RITUVIA_FUZZING
  (void)code;
#else
  fprintf(stderr, "%s\n", code);
#endif
  return 1;
}

static int parse_long(const char *value, long minimum, long maximum, long *output) {
  char *end = NULL;
  errno = 0;
  long parsed = strtol(value, &end, 10);
  if (errno != 0 || end == value || *end != '\0' || parsed < minimum || parsed > maximum) {
    return 0;
  }
  *output = parsed;
  return 1;
}

static int is_house_system(char value) {
  return value == 'P' || value == 'W' || value == 'A';
}

int main(int argc, char **argv) {
  if (argc != 12) {
    return fail("RITUVIA_NATIVE_ARGUMENTS_INVALID");
  }

  long year = 0;
  long month = 0;
  long day = 0;
  long hour = 0;
  long minute = 0;
  long millisecond = 0;
  long latitude_e6 = 0;
  long longitude_e6 = 0;
  long include_houses = 0;
  if (!parse_long(argv[2], 1800, 2199, &year) ||
      !parse_long(argv[3], 1, 12, &month) ||
      !parse_long(argv[4], 1, 31, &day) ||
      !parse_long(argv[5], 0, 23, &hour) ||
      !parse_long(argv[6], 0, 59, &minute) ||
      !parse_long(argv[7], 0, 59999, &millisecond) ||
      !parse_long(argv[8], -90000000, 90000000, &latitude_e6) ||
      !parse_long(argv[9], -180000000, 180000000, &longitude_e6) ||
      strlen(argv[10]) != 1 ||
      !is_house_system(argv[10][0]) ||
      !parse_long(argv[11], 0, 1, &include_houses)) {
    return fail("RITUVIA_NATIVE_ARGUMENTS_INVALID");
  }

  swe_set_ephe_path(argv[1]);

  char error_message[AS_MAXCH] = {0};
  double julian_days[2] = {0};
  double seconds = (double)(millisecond / 1000) + (double)(millisecond % 1000) / 1000.0;
  int utc_result = swe_utc_to_jd((int)year, (int)month, (int)day, (int)hour, (int)minute, seconds,
                                 SE_GREG_CAL, julian_days, error_message);
  if (utc_result == ERR || !isfinite(julian_days[1])) {
    swe_close();
    return fail("RITUVIA_NATIVE_UTC_CONVERSION_FAILED");
  }

  const int planet_ids[] = {
      SE_SUN, SE_MOON, SE_MERCURY, SE_VENUS, SE_MARS, SE_JUPITER,
      SE_SATURN, SE_URANUS, SE_NEPTUNE, SE_PLUTO, SE_TRUE_NODE,
  };
  const char *planet_names[] = {
      "sun", "moon", "mercury", "venus", "mars", "jupiter",
      "saturn", "uranus", "neptune", "pluto", "true_node",
  };
  const size_t planet_count = sizeof(planet_ids) / sizeof(planet_ids[0]);
  const int requested_flags = SEFLG_SWIEPH | SEFLG_SPEED;
  double positions[11][6] = {{0}};
  int returned_flags[11] = {0};

  for (size_t index = 0; index < planet_count; index += 1) {
    memset(error_message, 0, sizeof(error_message));
    returned_flags[index] =
        swe_calc_ut(julian_days[1], planet_ids[index], requested_flags, positions[index],
                    error_message);
    if (returned_flags[index] == ERR) {
      swe_close();
      return fail("RITUVIA_NATIVE_PLANET_CALCULATION_FAILED");
    }
    for (size_t value_index = 0; value_index < 6; value_index += 1) {
      if (!isfinite(positions[index][value_index])) {
        swe_close();
        return fail("RITUVIA_NATIVE_NON_FINITE_RESULT");
      }
    }
  }

  double house_cusps[13] = {0};
  double angles[10] = {0};
  if (include_houses == 1) {
    int house_result =
        swe_houses_ex(julian_days[1], requested_flags, (double)latitude_e6 / 1000000.0,
                      (double)longitude_e6 / 1000000.0, (int)argv[10][0], house_cusps, angles);
    if (house_result == ERR) {
      swe_close();
      return fail("RITUVIA_NATIVE_HOUSE_CALCULATION_FAILED");
    }
    for (size_t cusp_index = 1; cusp_index <= 12; cusp_index += 1) {
      if (!isfinite(house_cusps[cusp_index])) {
        swe_close();
        return fail("RITUVIA_NATIVE_NON_FINITE_RESULT");
      }
    }
  }

  char version[AS_MAXCH] = {0};
  swe_version(version);
#ifndef RITUVIA_FUZZING
  printf("{\"schemaVersion\":\"astrology-native-execution.v1\",\"engineVersion\":\"%s\","
         "\"julianDayUt\":%.15g,\"positions\":[",
         version, julian_days[1]);
  for (size_t index = 0; index < planet_count; index += 1) {
    if (index > 0) {
      putchar(',');
    }
    printf("{\"body\":\"%s\",\"longitudeDegrees\":%.15g,\"latitudeDegrees\":%.15g,"
           "\"distanceAu\":%.15g,\"longitudeSpeedDegreesPerDay\":%.15g,"
           "\"returnedEphemerisFlags\":%d}",
           planet_names[index], positions[index][0], positions[index][1], positions[index][2],
           positions[index][3], returned_flags[index]);
  }
  if (include_houses == 1) {
    printf("],\"houseCuspsDegrees\":[");
    for (size_t cusp_index = 1; cusp_index <= 12; cusp_index += 1) {
      if (cusp_index > 1) {
        putchar(',');
      }
      printf("%.15g", house_cusps[cusp_index]);
    }
    printf("],\"angles\":{\"ascendantDegrees\":%.15g,\"midheavenDegrees\":%.15g,"
           "\"armcDegrees\":%.15g,\"vertexDegrees\":%.15g}}\n",
           angles[0], angles[1], angles[2], angles[3]);
  } else {
    printf("],\"houseCuspsDegrees\":null,\"angles\":null}\n");
  }
#endif

  swe_close();
  return 0;
}
