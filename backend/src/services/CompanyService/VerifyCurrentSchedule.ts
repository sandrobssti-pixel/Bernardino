import Company from "../../models/Company";
import Queue from "../../models/Queue";
import Whatsapp from "../../models/Whatsapp";

type ScheduleEntry = {
  id?: number | string;
  date?: string;
  weekday?: string;
  weekdayEn?: string;
  dayMode?: string;
  startTimeA?: string;
  endTimeA?: string;
  startTimeB?: string;
  endTimeB?: string;
  message?: string;
};

type Result = {
  id: number;
  currentSchedule: ScheduleEntry | null;
  holidaySchedule: ScheduleEntry | null;
  weekdayEnExpected: string;
  weekdayPtExpected: string[];
  storedWeekdays: string[];
  startTimeA: string | null;
  endTimeA: string | null;
  startTimeB: string | null;
  endTimeB: string | null;
  inActivity: boolean;
  isHoliday: boolean;
  message: string;
};

type ScheduleSource = {
  id: number;
  schedules?: ScheduleEntry[];
  holidaySchedules?: ScheduleEntry[];
};

const WEEKDAY_MAP = [
  { weekdayEn: "sunday", weekdayPt: ["domingo"] },
  { weekdayEn: "monday", weekdayPt: ["segunda", "segunda-feira"] },
  { weekdayEn: "tuesday", weekdayPt: ["terca", "terca-feira", "terca-feira", "terça", "terça-feira"] },
  { weekdayEn: "wednesday", weekdayPt: ["quarta", "quarta-feira"] },
  { weekdayEn: "thursday", weekdayPt: ["quinta", "quinta-feira"] },
  { weekdayEn: "friday", weekdayPt: ["sexta", "sexta-feira"] },
  { weekdayEn: "saturday", weekdayPt: ["sabado", "sábado"] }
];

const normalizeText = (value: unknown): string =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const pad = (value: number): string => String(value).padStart(2, "0");

const getCurrentDateInfo = () => {
  const now = new Date();
  const weekdayIndex = now.getDay();
  const weekdayInfo = WEEKDAY_MAP[weekdayIndex];

  return {
    now,
    dateKey: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    weekdayEn: weekdayInfo.weekdayEn,
    weekdayPt: weekdayInfo.weekdayPt
  };
};

const parseTimeToMinutes = (value?: string): number | null => {
  if (!value) return null;

  const match = String(value).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
};

const isWithinPeriod = (
  nowMinutes: number,
  startTime?: string,
  endTime?: string
): boolean => {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);

  if (start === null || end === null) {
    return false;
  }

  return nowMinutes >= start && nowMinutes <= end;
};

const resolveInActivity = (
  schedule: ScheduleEntry | null,
  now: Date
): boolean => {
  if (!schedule) return false;

  const dayMode = normalizeText(schedule.dayMode || "hours");

  if (dayMode === "open") return true;
  if (dayMode === "closed") return false;

  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  return (
    isWithinPeriod(nowMinutes, schedule.startTimeA, schedule.endTimeA) ||
    isWithinPeriod(nowMinutes, schedule.startTimeB, schedule.endTimeB)
  );
};

const describeStoredWeekdays = (schedules: ScheduleEntry[] = []): string[] =>
  schedules.map(item =>
    [String(item?.weekdayEn || "").trim(), String(item?.weekday || "").trim()]
      .filter(Boolean)
      .join(" | ")
  );

const findWeeklySchedule = (
  schedules: ScheduleEntry[] = [],
  weekdayEnExpected: string,
  weekdayPtExpected: string[]
): ScheduleEntry | null => {
  const weekdayPtSet = new Set(weekdayPtExpected.map(normalizeText));

  return (
    schedules.find(item => {
      const normalizedEn = normalizeText(item?.weekdayEn);
      const normalizedPt = normalizeText(item?.weekday);

      return (
        normalizedEn === normalizeText(weekdayEnExpected) ||
        weekdayPtSet.has(normalizedPt)
      );
    }) || null
  );
};

const findHolidaySchedule = (
  holidaySchedules: ScheduleEntry[] = [],
  dateKey: string
): ScheduleEntry | null =>
  holidaySchedules.find(item => String(item?.date || "").trim() === dateKey) || null;

const buildResult = (
  source: ScheduleSource,
  scope: string
): Result => {
  const { now, dateKey, weekdayEn, weekdayPt } = getCurrentDateInfo();
  const schedules = Array.isArray(source.schedules) ? source.schedules : [];
  const holidaySchedules = Array.isArray(source.holidaySchedules)
    ? source.holidaySchedules
    : [];

  const holidaySchedule = findHolidaySchedule(holidaySchedules, dateKey);
  const weeklySchedule = findWeeklySchedule(schedules, weekdayEn, weekdayPt);
  const currentSchedule = holidaySchedule || weeklySchedule;
  const result: Result = {
    id: source.id,
    currentSchedule,
    holidaySchedule,
    weekdayEnExpected: weekdayEn,
    weekdayPtExpected: weekdayPt,
    storedWeekdays: describeStoredWeekdays(schedules),
    startTimeA: currentSchedule?.startTimeA || null,
    endTimeA: currentSchedule?.endTimeA || null,
    startTimeB: currentSchedule?.startTimeB || null,
    endTimeB: currentSchedule?.endTimeB || null,
    message: String(holidaySchedule?.message || ""),
    isHoliday: Boolean(holidaySchedule),
    inActivity: resolveInActivity(currentSchedule, now)
  };

  console.info("[SCHEDULE_VERIFY]", {
    scope,
    companyId: (source as any).companyId,
    queueId: scope === "queue" ? source.id : 0,
    whatsappId: scope === "connection" ? source.id : 0,
    result
  });

  return result;
};

const loadSource = async (
  companyId?: number,
  queueId?: number,
  whatsappId?: number
): Promise<{ source: ScheduleSource | null; scope: string }> => {
  if (Number(whatsappId) > 0 && Number(queueId) === 0) {
    const source = await Whatsapp.findOne({
      attributes: ["id", "companyId", "schedules", "holidaySchedules"],
      where: { id: whatsappId, companyId }
    });

    return { source: source?.get({ plain: true }) as ScheduleSource | null, scope: "connection" };
  }

  if (Number(queueId) > 0) {
    const source = await Queue.findOne({
      attributes: ["id", "companyId", "schedules", "holidaySchedules"],
      where: { id: queueId, companyId }
    });

    return { source: source?.get({ plain: true }) as ScheduleSource | null, scope: "queue" };
  }

  const source = await Company.findByPk(companyId, {
    attributes: ["id", "schedules", "holidaySchedules"]
  });

  return { source: source?.get({ plain: true }) as ScheduleSource | null, scope: "company" };
};

const VerifyCurrentSchedule = async (
  companyId?: number,
  queueId?: number,
  whatsappId?: number
): Promise<Result> => {
  const { source, scope } = await loadSource(companyId, queueId, whatsappId);

  if (!source) {
    const { weekdayEn, weekdayPt } = getCurrentDateInfo();
    const emptyResult: Result = {
      id: Number(queueId) || Number(whatsappId) || Number(companyId) || 0,
      currentSchedule: null,
      holidaySchedule: null,
      weekdayEnExpected: weekdayEn,
      weekdayPtExpected: weekdayPt,
      storedWeekdays: [],
      startTimeA: null,
      endTimeA: null,
      startTimeB: null,
      endTimeB: null,
      inActivity: false,
      isHoliday: false,
      message: ""
    };

    console.info("[SCHEDULE_VERIFY]", {
      scope,
      companyId,
      queueId,
      whatsappId,
      result: emptyResult
    });

    return emptyResult;
  }

  return buildResult(source, scope);
};

export default VerifyCurrentSchedule;
