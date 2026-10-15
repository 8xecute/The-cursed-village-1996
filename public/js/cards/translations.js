import { client } from '../core/client.js';

client.actions.displayCardName = function displayCardName(name) {
    const map = {
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
        'Witch': 'ปอบ',
        'Not A Witch': 'ชาวบ้าน',
        'Constable': 'หมอผี',
    };
    return map[name] || name;
};

client.actions.displayCardDescription = function displayCardDescription(name) {
    const map = {
        'Accusation': 'ใช้เพื่อกล่าวหาผู้เล่นที่สงสัยว่าเป็นปอบ (เพิ่ม 1 ข้อกล่าวหา)',
        'Evidence': 'ใช้เพื่อกล่าวหาผู้เล่นที่สงสัยว่าเป็นปอบ (เพิ่ม 3 ข้อกล่าวหา)',
        'Witness': 'ใช้เพื่อกล่าวหาผู้เล่นที่สงสัยว่าเป็นปอบ (เพิ่ม 7 ข้อกล่าวหา)',
        'Scapegoat': 'ย้ายการ์ดสีน้ำเงิน, เขียว, แดงของผู้เล่นคนหนึ่ง ไปยังผู้เล่นอีกคนหนึ่ง',
        'Curse': 'ทำลายการ์ดสีน้ำเงิน 1 ใบ ที่อยู่หน้าผู้เล่นเป้าหมาย',
        'Alibi': 'ลบการ์ดข้อกล่าวหาออกจากผู้เล่นเป้าหมายได้สูงสุด 3 ใบ',
        'Robbery': 'ขโมยการ์ดบนมือทั้งหมดจากผู้เล่นคนหนึ่ง ไปให้ผู้เล่นอีกคนหนึ่ง',
        'Stocks': 'ผู้เล่นที่ถูกการ์ดนี้จะต้องข้ามตาของตัวเอง',
        'Arson': 'บังคับให้ผู้เล่นเป้าหมายทิ้งการ์ดบนมือทั้งหมด',
        'Black Cat': 'ผู้เล่นที่ถือการ์ดนี้จะต้องเริ่มเล่นเป็นคนแรก และหากมีผู้เล่นเปิดได้ "พิธีเซ่นไหว้" ผู้เล่นที่ถือ "เครื่องเซ่น" จะต้องเปิดการ์ดชีวิต 1 ใบ',
        'Asylum': 'ป้องกันการถูกสังหารในช่วง "ยามวิกาล"',
        'Piety': 'การ์ดข้อกล่าวหา (สีแดง) จะไม่มีผลกับผู้เล่นที่ถือการ์ดนี้',
        'Matchmaker': 'ผู้เล่น 2 คนที่ถือการ์ดนี้ หากคนใดคนหนึ่งตาย อีกคนต้องตายตาม',
        'Conspiracy': 'ผู้เล่นที่เปิดการ์ดนี้ ต้องเปิดการ์ดชีวิต 1 ใบของผู้เล่นที่มี "เครื่องเซ่น" จากนั้นจะเกิดเหตุการณ์ให้ผู้เล่นทุกคนหยิบการ์ดชีวิตจากผู้เล่นทางซ้ายมือ 1 ใบ (ช่วงที่ปอบแพร่เชื้อ)',
        'Night': 'ผู้ดำเนินเกมสั่งให้ทุกคนหลับตา "ปอบ" เลือกเหยื่อเพื่อสังหาร และ "หมอผี" เลือก 1 คนเพื่อปัดเป่าป้องกัน',
        'Witch': 'ผู้เล่นที่มีการ์ดนี้จะเป็น "ปอบ" ไปจนจบเกม แม้การ์ดจะถูกส่งต่อให้คนอื่นก็ตาม',
        'Not A Witch': 'เป็นชาวบ้านธรรมดา ไม่มีความสามารถพิเศษ',
        'Constable': 'สามารถปัดเป่าปกป้องผู้เล่นคนอื่นจากการถูกปอบสิงฆ่าในยามวิกาล',
    };
    return map[name] || '';
};

client.actions.getCardNameTH = function getCardNameTH(name) {
    if (name && typeof name === 'object') {
        return client.state.cardNameMap[name.name] || name.name || '';
    }
    return client.state.cardNameMap[name] || name;
};

client.actions.replaceCardNamesInMessage = function replaceCardNamesInMessage(message) {
    // เรียงลำดับชื่อการ์ดจากยาวไปสั้นเพื่อป้องกันการแทนที่ซ้อน
    const cardNames = Object.keys(client.state.cardNameMap).sort((a, b) => b.length - a.length);
    let result = message;
    cardNames.forEach(en => {
        // ใช้ regex แบบ whole word (\b) เพื่อไม่ให้แทนที่คำที่ซ้อนกัน
        const regex = new RegExp(`\\b${en}\\b`, 'g');
        result = result.replace(regex, client.state.cardNameMap[en]);
    });
    return result;
};

client.actions.getPhaseNameTH = function getPhaseNameTH(phase) {
  switch (phase) {
    case 'DAY': return 'กลางวัน';
    case 'NIGHT': return 'กลางคืน';
    case 'PRE_DAWN': return 'ก่อนรุ่งสาง';
    case 'GAME_OVER': return 'จบเกม';
    case 'LOBBY': return 'รอล็อบบี้';
    default: return phase;
  }
};

export function initialize() {

}
