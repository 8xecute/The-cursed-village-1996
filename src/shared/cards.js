const CARD_TEMPLATES = {
  conspiracy: {
    name: 'Conspiracy',
    type: 'Event',
    color: 'Black',
    description: 'ผู้เล่นที่เปิดได้การ์ดนี้ ให้เลือกเปิดการ์ดชีวิต 1 ใบ ของผู้เล่นที่มีการ์ดเครื่องเซ่นอยู่ข้างหน้า. จากนั้นจะเกิดเหตุการณ์ ผู้เล่นทุกคนหยิบการ์ดชีวิตจากผู้เล่นที่อยู่ทางซ้ายมือ 1 ใบ.'
  },
  night: {
    name: 'Night',
    type: 'Event',
    color: 'Black',
    description: 'เมื่อจั่วได้การ์ดนี้ จะเกิดเหตุการณ์: ผู้ดำเนินเกมจะให้ผู้เล่นทุกคนหลับตา จากนั้นปอบทำการสังหารผู้เล่นหนึ่งคน และหมอผีต้องทำการวางโทเคนค้อนเพื่อปกป้องผู้เล่น 1 คน.'
  }
};

function getGameCardsForPlayerCount(playerCount) {
  if (playerCount <= 5) {
    return [
      ...Array(18).fill({ name: 'Accusation', type: 'Accusation', color: 'Red', value: 1, description: 'กล่าวหาผู้เล่นคนอื่น (1 ข้อกล่าวหา).' }),
      ...Array(4).fill({ name: 'Evidence', type: 'Accusation', color: 'Red', value: 3, description: 'กล่าวหาผู้เล่นคนอื่น (3 ข้อกล่าวหา).' }),
      ...Array(2).fill({ name: 'Witness', type: 'Accusation', color: 'Red', value: 7, description: 'กล่าวหาผู้เล่นคนอื่น (7 ข้อกล่าวหา).' }),
      ...Array(2).fill({ name: 'Scapegoat', type: 'Action', color: 'Green', description: 'ย้ายการ์ดสีน้ำเงิน, เขียว และแดง ของจากผู้เล่นเป้าหมาย ไปอีกผู้เล่นหนึ่ง. (เลือกเป้าหมาย 2 คน)' }),
      ...Array(1).fill({ name: 'Curse', type: 'Action', color: 'Green', description: 'ลบการ์ดสีน้ำเงินที่ผู้เล่นเป้าหมายโดน 1 ใบลงไปที่กองทิ้ง. (เลือกเป้าหมาย)' }),
      ...Array(2).fill({ name: 'Alibi', type: 'Action', color: 'Green', description: 'ลบข้อกล่าวหาของผู้เล่นได้สูงสุด 3 ใบ. (เลือกเป้าหมาย)' }),
      ...Array(1).fill({ name: 'Robbery', type: 'Action', color: 'Green', description: 'ขโมยการ์ดบนมือทั้งหมดจากผู้เล่นเป้าหมาย ไปอีกผู้เล่นหนึ่ง. (เลือกเป้าหมาย 2 คน)' }),
      ...Array(1).fill({ name: 'Stocks', type: 'Permanent', color: 'Green', description: 'ข้ามตาของผู้เล่นที่โดนการ์ดนี้ สามารถ stack การ์ดนี้เพื่อข้ามตาหลายรอบได้. (เลือกเป้าหมาย)' }),
      ...Array(1).fill({ name: 'Arson', type: 'Action', color: 'Green', description: 'ทิ้งการ์ดในมือทั้งหมดของผู้เล่นเป้าหมายไปที่กองทิ้ง. (เลือกเป้าหมาย)' }),
      ...Array(1).fill({ name: 'Black Cat', type: 'Permanent', color: 'Blue', description: 'หากการ์ดนี้อยู่กับผู้เล่นคนไหน จะต้องเริ่มเล่นเป็นคนแรก. หากมีผู้เล่นคนไหนเปิดได้การ์ดเจตนาร้าย, ผู้เล่นที่มีการ์ดเครื่องเซ่นจะต้องเปิดการ์ดชีวิต 1 ใบ.' }),
      ...Array(1).fill({ name: 'Asylum', type: 'Permanent', color: 'Blue', description: 'เลือกผู้เล่นที่จะป้องกันการถูกฆ่าในรอบกลางคืน. (เลือกเป้าหมาย)' }),
      ...Array(1).fill({ name: 'Piety', type: 'Permanent', color: 'Blue', description: 'เลือกผู้เล่นที่ไม่สามารถถูกโจมตีด้วยการ์ดสีแดงได้. (เลือกเป้าหมาย)' }),
      ...Array(2).fill({ name: 'Matchmaker', type: 'Permanent', color: 'Blue', description: 'เลือกวางการ์ดหน้าผู้เล่นเป้าหมาย (ผู้เล่น 2 คนที่มีการ์ดนี้อยู่ตรงหน้า หากผู้เล่นคนใดคนหนึ่งตาย อีกคนต้องตายตาม). (เลือกเป้าหมาย)' }),
      ...Array(1).fill(CARD_TEMPLATES.conspiracy),
      ...Array(1).fill(CARD_TEMPLATES.night)
    ];
  } else {
    return [
      // Accusation Cards (Red)
      ...Array(26).fill({ name: 'Accusation', type: 'Accusation', color: 'Red', value: 1, description: 'กล่าวหาผู้เล่นคนอื่น (1 ข้อกล่าวหา).' }),
      ...Array(8).fill({ name: 'Evidence', type: 'Accusation', color: 'Red', value: 3, description: 'กล่าวหาผู้เล่นคนอื่น (3 ข้อกล่าวหา).' }),
      ...Array(3).fill({ name: 'Witness', type: 'Accusation', color: 'Red', value: 7, description: 'กล่าวหาผู้เล่นคนอื่น (7 ข้อกล่าวหา).' }),
      // Action Cards (Green)
      ...Array(2).fill({ name: 'Scapegoat', type: 'Action', color: 'Green', description: 'ย้ายการ์ดสีน้ำเงิน, เขียว และแดง ของจากผู้เล่นเป้าหมาย ไปอีกผู้เล่นหนึ่ง. (เลือกเป้าหมาย 2 คน)' }),
      ...Array(2).fill({ name: 'Curse', type: 'Action', color: 'Green', description: 'ลบการ์ดสีน้ำเงินที่ผู้เล่นเป้าหมายโดน 1 ใบลงไปที่กองทิ้ง. (เลือกเป้าหมาย)' }),
      ...Array(3).fill({ name: 'Alibi', type: 'Action', color: 'Green', description: 'ลบข้อกล่าวหาของผู้เล่นได้สูงสุด 3 ใบ. (เลือกเป้าหมาย)' }),
      ...Array(2).fill({ name: 'Robbery', type: 'Action', color: 'Green', description: 'ขโมยการ์ดบนมือทั้งหมดจากผู้เล่นเป้าหมาย ไปอีกผู้เล่นหนึ่ง. (เลือกเป้าหมาย 2 คน)' }),
      ...Array(2).fill({ name: 'Stocks', type: 'Permanent', color: 'Green', description: 'ข้ามตาของผู้เล่นที่โดนการ์ดนี้ สามารถ stack การ์ดนี้เพื่อข้ามตาหลายรอบได้. (เลือกเป้าหมาย)' }),
      ...Array(2).fill({ name: 'Arson', type: 'Action', color: 'Green', description: 'ทิ้งการ์ดในมือทั้งหมดของผู้เล่นเป้าหมายไปที่กองทิ้ง. (เลือกเป้าหมาย)' }),
      // Permanent Cards (Blue)
      ...Array(1).fill({ name: 'Black Cat', type: 'Permanent', color: 'Blue', description: 'หากการ์ดนี้อยู่กับผู้เล่นคนไหน จะต้องเริ่มเล่นเป็นคนแรก. หากมีผู้เล่นคนไหนเปิดได้การ์ดเจตนาร้าย, ผู้เล่นที่มีการ์ดเครื่องเซ่นจะต้องเปิดการ์ดชีวิต 1 ใบ.' }),
      ...Array(1).fill({ name: 'Asylum', type: 'Permanent', color: 'Blue', description: 'เลือกผู้เล่นที่จะป้องกันการถูกฆ่าในรอบกลางคืน. (เลือกเป้าหมาย)' }),
      ...Array(1).fill({ name: 'Piety', type: 'Permanent', color: 'Blue', description: 'เลือกผู้เล่นที่ไม่สามารถถูกโจมตีด้วยการ์ดสีแดงได้. (เลือกเป้าหมาย)' }),
      ...Array(2).fill({ name: 'Matchmaker', type: 'Permanent', color: 'Blue', description: 'เลือกวางการ์ดหน้าผู้เล่นเป้าหมาย (ผู้เล่น 2 คนที่มีการ์ดนี้อยู่ตรงหน้า หากผู้เล่นคนใดคนหนึ่งตาย อีกคนต้องตายตาม). (เลือกเป้าหมาย)' }),
      // Event Cards (Black)
      ...Array(1).fill(CARD_TEMPLATES.conspiracy),
      ...Array(1).fill(CARD_TEMPLATES.night)
    ];
  }
}

module.exports = { getGameCardsForPlayerCount };
