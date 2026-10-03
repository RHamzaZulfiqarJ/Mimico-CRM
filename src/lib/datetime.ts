export function localDateTimeToUtc(value: string, timezoneOffsetMinutes: number) {
  const [datePart, timePart] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);

  return new Date(
    Date.UTC(year, month - 1, day, hour, minute) + timezoneOffsetMinutes * 60_000,
  );
}
