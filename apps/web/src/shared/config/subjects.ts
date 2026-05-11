export const SUBJECTS = [
  "Toán",
  "Ngữ văn",
  "Tiếng Anh",
  "Vật lý",
  "Hóa học",
  "Sinh học",
  "Lịch sử",
  "Địa lý",
  "Tin học",
  "Giáo dục công dân",
  "Thể dục",
  "Âm nhạc",
  "Mỹ thuật",
  "Khoa học tự nhiên",
  "Khoa học xã hội",
  "Công nghệ",
] as const;

export const GRADES = Array.from({ length: 12 }, (_, i) => i + 1);
