type DateInput = Date | string | number;

const toDate = (value: DateInput): Date => {
  if (value instanceof Date) {
    return new Date(value.getTime());
  }
  return new Date(value);
};

const pad = (value: number) => value.toString().padStart(2, '0');

export const addDays = (input: DateInput, amount: number): Date => {
  const date = toDate(input);
  date.setDate(date.getDate() + amount);
  return date;
};

export const startOfWeek = (input: DateInput, options?: { weekStartsOn?: number }): Date => {
  const date = toDate(input);
  const weekStartsOn = options?.weekStartsOn ?? 0;
  const day = date.getDay();
  const diff = (day - weekStartsOn + 7) % 7;
  const result = new Date(date);
  result.setDate(date.getDate() - diff);
  result.setHours(0, 0, 0, 0);
  return result;
};

export const differenceInDays = (left: DateInput, right: DateInput): number => {
  const start = toDate(left);
  const end = toDate(right);
  const msPerDay = 1000 * 60 * 60 * 24;
  const startUTC = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUTC = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((startUTC - endUTC) / msPerDay);
};

const formatWithIntl = (date: Date, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-US', options).format(date);

export const format = (input: DateInput, pattern: string): string => {
  const date = toDate(input);

  switch (pattern) {
    case 'yyyy-MM-dd':
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    case 'yyyy-MM-dd HH:mm':
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
        date.getHours()
      )}:${pad(date.getMinutes())}`;
    case 'EEE, MMM d':
      return formatWithIntl(date, { weekday: 'short', month: 'short', day: 'numeric' });
    case 'PP':
      return formatWithIntl(date, { dateStyle: 'medium' });
    case 'PPpp':
      return formatWithIntl(date, { dateStyle: 'medium', timeStyle: 'short' });
    default:
      return date.toLocaleString();
  }
};
