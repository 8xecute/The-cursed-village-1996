const { getGameCardsForPlayerCount } = require('../shared/cards');
const PLAYER_LIMIT = 12;

const MIN_PLAYERS_TO_START = 4;

const RECONNECT_TIMEOUT = 120 * 1000;

const DEFAULT_PHASE_DURATIONS = {
    LOBBY: 0, // No timer for lobby
    DAY: 0, // No automatic timer - Host advances
    NIGHT: 0, // No automatic timer - Host advances, but special timer for Night actions
    PRE_DAWN: 0, // No automatic timer - Host advances, confession period
    CONFESSION: 0, // Players choose to confess or skip without a time limit.
    GAME_OVER: 0, // No timer
};

const CARD_TEMPLATES = {
    conspiracy: { name: 'Conspiracy', type: 'Event', color: 'Black', description: 'ผู้เล่นที่เปิดได้การ์ดนี้ ให้เลือกเปิดการ์ดชีวิต 1 ใบ ของผู้เล่นที่มีการ์ดเครื่องเซ่นอยู่ข้างหน้า. จากนั้นจะเกิดเหตุการณ์ ผู้เล่นทุกคนหยิบการ์ดชีวิตจากผู้เล่นที่อยู่ทางซ้ายมือ 1 ใบ' },
    night: { name: 'Night', type: 'Event', color: 'Black', description: 'เมื่อจั่วได้การ์ดนี้ จะเกิดเหตุการณ์: ผู้ดำเนินเกมจะให้ผู้เล่นทุกคนหลับตา จากนั้นปอบทำการสังหารผู้เล่นหนึ่งคน และหมอผีจะต้องทำการปัดเป่าเพื่อปกป้องผู้เล่น 1 คน' }
};

const GAME_CARDS = getGameCardsForPlayerCount();

const TRYAL_CARDS_BASE = [
    { name: 'Witch', type: 'Role' },
    { name: 'Constable', type: 'Role' },
    { name: 'Not A Witch', type: 'Role' }
];

const CARDS_NEED_TARGET = ['Accusation', 'Evidence', 'Witness', 'Curse', 'Alibi', 'Robbery', 'Stocks', 'Arson', 'Scapegoat', 'Asylum', 'Piety', 'Matchmaker', 'Black Cat'];

const CARDS_NEED_TWO_TARGETS = ['Scapegoat', 'Robbery'];

const CARD_NAME_THAI = {
  'Accusation': 'ข้อกล่าวหา',
  'Evidence': 'หลักฐาน',
  'Witness': 'พยาน',
  'Scapegoat': 'แพะรับบาป',
  'Curse': 'คำสาป',
  'Alibi': 'ข้อแก้ต่าง',
  'Robbery': 'ช่วงชิง',
  'Stocks': 'พันธนาการ',
  'Arson': 'วางเพลิง',
  'Black Cat': 'เครื่องเซ่น',
  'Asylum': 'ที่หลบภัย',
  'Piety': 'พลังศรัทธา',
  'Matchmaker': 'ผูกวิญญาณ',
  'Conspiracy': 'พิธีเซ่นไหว้',
  'Night': 'ยามวิกาล',
};

const CARD_DESCRIPTION_THAI = {
    'Accusation': 'ใช้เพื่อกล่าวหาผู้เล่นที่สงสัยว่าเป็นปอบ (เพิ่ม 1 ข้อกล่าวหา)',
    'Evidence': 'ใช้เพื่อกล่าวหาผู้เล่นที่สงสัยว่าเป็นปอบ (เพิ่ม 3 ข้อกล่าวหา)',
    'Witness': 'ใช้เพื่อกล่าวหาผู้เล่นที่สงสัยว่าเป็นปอบ (เพิ่ม 7 ข้อกล่าวหา)',
    'Scapegoat': 'ย้ายการ์ดสีน้ำเงิน, เขียว, แดงของผู้เล่นคนหนึ่ง ไปยังผู้เล่นอีกคนหนึ่ง',
    'Curse': 'ทำลายการ์ดสีน้ำเงิน 1 ใบ ที่อยู่หน้าผู้เล่นเป้าหมาย',
    'Alibi': 'ลบข้อกล่าวหารวมสูงสุด 3 แต้ม: ข้อกล่าวหา (+1) สูงสุด 3 ใบ หรือหลักฐาน (+3) 1 ใบ',
    'Robbery': 'ขโมยการ์ดบนมือทั้งหมดจากผู้เล่นคนหนึ่ง ไปให้ผู้เล่นอีกคนหนึ่ง',
    'Stocks': 'ผู้เล่นที่ถูกการ์ดนี้จะต้องข้ามตาของตัวเอง',
    'Arson': 'บังคับให้ผู้เล่นเป้าหมายทิ้งการ์ดบนมือทั้งหมด',
    'Black Cat': 'เล่นใส่ผู้เล่นอื่นเท่านั้น (เลือกตัวเองได้เฉพาะตอนเริ่มเกม) ผู้เล่นที่ถือการ์ดนี้จะต้องเริ่มเล่นเป็นคนแรก และหากมีผู้เล่นเปิดได้ "พิธีเซ่นไหว้" ผู้เล่นที่ถือ "เครื่องเซ่น" จะต้องเปิดการ์ดชีวิต 1 ใบ',
    'Asylum': 'ป้องกันการถูกสังหารในช่วง "ยามวิกาล"',
    'Piety': 'การ์ดข้อกล่าวหา (สีแดง) จะไม่มีผลกับผู้เล่นที่ถือการ์ดนี้',
    'Matchmaker': 'ผู้เล่น 2 คนที่ถือการ์ดนี้ หากคนใดคนหนึ่งตาย อีกคนต้องตายตาม',
    'Conspiracy': 'ผู้เล่นที่เปิดการ์ดนี้ ต้องเปิดการ์ดชีวิต 1 ใบของผู้เล่นที่มี "เครื่องเซ่น" จากนั้นจะเกิดเหตุการณ์ให้ผู้เล่นทุกคนหยิบการ์ดชีวิตจากผู้เล่นทางซ้ายมือ 1 ใบ (ช่วงที่ปอบแพร่เชื้อ)',
    'Night': 'ผู้ดำเนินเกมสั่งให้ทุกคนหลับตา "ปอบ" เลือกเหยื่อเพื่อสังหาร และ "หมอผี" เลือก 1 คนเพื่อปัดเป่าป้องกัน',
    'Witch': 'ผู้เล่นที่มีการ์ดนี้จะเป็น "ปอบ" ไปจนจบเกม แม้การ์ดจะถูกส่งต่อให้คนอื่นก็ตาม',
    'Not A Witch': 'เป็นชาวบ้านธรรมดา ไม่มีความสามารถพิเศษ',
    'Constable': 'สามารถปัดเป่าปกป้องผู้เล่นคนอื่นจากการถูกปอบสิงฆ่าในยามวิกาล',
};

module.exports = { PLAYER_LIMIT, MIN_PLAYERS_TO_START, RECONNECT_TIMEOUT, DEFAULT_PHASE_DURATIONS, CARD_TEMPLATES, GAME_CARDS, TRYAL_CARDS_BASE, CARDS_NEED_TARGET, CARDS_NEED_TWO_TARGETS, CARD_NAME_THAI, CARD_DESCRIPTION_THAI };
