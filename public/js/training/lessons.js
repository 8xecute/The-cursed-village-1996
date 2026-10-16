export const cardNames = {
    Accusation: 'ข้อกล่าวหา', Evidence: 'หลักฐาน', Witness: 'พยาน',
    Scapegoat: 'แพะรับบาป', Curse: 'คำสาป', Alibi: 'ข้อแก้ต่าง', Robbery: 'ช่วงชิง',
    Stocks: 'พันธนาการ', Arson: 'วางเพลิง', 'Black Cat': 'เครื่องเซ่น',
    Asylum: 'ที่หลบภัย', Piety: 'พลังศรัทธา', Matchmaker: 'ผูกวิญญาณ',
    Conspiracy: 'พิธีเซ่นไหว้', Night: 'ยามวิกาล', Witch: 'ปอบ',
    'Not A Witch': 'ชาวบ้าน', Constable: 'หมอผี',
};

export function getTrainingCardCategory(name) {
    if (['Accusation', 'Evidence', 'Witness'].includes(name)) return { className: 'card-red', label: 'สีแดง · ข้อกล่าวหา' };
    if (['Scapegoat', 'Curse', 'Alibi', 'Robbery', 'Stocks', 'Arson'].includes(name)) return { className: 'card-green', label: 'สีเขียว · การ์ดพิเศษ' };
    if (['Black Cat', 'Asylum', 'Piety', 'Matchmaker'].includes(name)) return { className: 'card-blue', label: 'สีน้ำเงิน · สถานะ' };
    if (['Conspiracy', 'Night'].includes(name)) return { className: 'card-black', label: 'สีดำ · เหตุการณ์' };
    return { className: 'training-life-card', label: 'การ์ดชีวิต · บทบาท' };
}

const card = (name, prompt, result, extra = {}) => ({
    id: name, chapter: 'ชาวบ้าน · ใช้การ์ด', role: 'ชาวบ้าน', phase: 'กลางวัน',
    kind: 'card', card: name, title: cardNames[name], prompt, result, ...extra,
});

export const lessons = [
    { id: 'welcome-life', chapter: 'เริ่มเล่น', role: 'ชาวบ้าน', phase: 'กลางวัน', kind: 'life',
        card: 'Not A Witch', title: 'การ์ดชีวิตของคุณ', prompt: 'แตะการ์ดชีวิตของคุณเพื่อดูบทบาท',
        result: 'คุณอยู่ทีมชาวบ้าน · การดูการ์ดตัวเองไม่ทำให้เสียการ์ดชีวิต' },
    { id: 'draw', chapter: 'เริ่มเล่น', role: 'ชาวบ้าน', phase: 'กลางวัน', kind: 'draw',
        title: 'ถึงตาคุณแล้ว', prompt: 'แตะกองจั่ว 2 ครั้งเพื่อยืนยันจั่ว 2 ใบ',
        result: 'ได้การ์ด 2 ใบ และจบเทิร์นอัตโนมัติ · เทิร์นจริงเลือกจั่วหรือเล่นการ์ด' },
    card('Accusation', 'เลือกข้อกล่าวหา → เลือกมาลี → เล่นการ์ด', 'มาลีได้รับข้อกล่าวหา +1 แต้ม'),
    card('Evidence', 'ใช้หลักฐานใส่มาลี', 'หลักฐานเพิ่มข้อกล่าวหา +3 แต้ม'),
    card('Witness', 'ใช้พยานใส่มาลี แล้วเลือกเปิดการ์ดชีวิตของเธอ',
        'พยานทำให้ต้องเปิดการ์ดชีวิต 1 ใบ · เปิดชาวบ้านแล้วมาลียังรอด'),
    card('Piety', 'วางพลังศรัทธาให้มาลี', 'มาลีได้รับโล่ป้องกันการ์ดสีแดง'),
    { ...card('Accusation', 'มาลีมีพลังศรัทธา ลองเลือกเธอ แล้วโจมตีคำปันแทน',
        'โจมตีคนที่มีพลังศรัทธาไม่ได้ · การ์ดไม่ถูกใช้จนเลือกเป้าหมายที่ถูกต้อง'), id: 'piety-block', protection: true },
    card('Curse', 'ใช้คำสาปใส่มาลี แล้วเลือกพลังศรัทธาที่จะทำลาย', 'นำพลังศรัทธาลงกองทิ้ง · มาลีไม่กันการ์ดแดงแล้ว'),
    card('Alibi', 'ใช้ข้อแก้ต่างกับมาลี แล้วเลือกข้อกล่าวหาที่จะนำออก', 'นำการ์ดข้อกล่าวหาออกได้สูงสุด 3 ใบ ไม่ใช่แค่ 3 แต้ม'),
    card('Stocks', 'ใช้พันธนาการใส่มาลี', 'เมื่อถึงตาของมาลี ระบบจะข้ามเทิร์นตามจำนวนพันธนาการ'),
    card('Arson', 'ใช้วางเพลิงใส่มาลี', 'การ์ดในมือมาลีถูกทิ้งทั้งหมด · การ์ดชีวิตไม่เสีย'),
    card('Robbery', 'เลือกมาลีเป็นผู้ถูกขโมย แล้วเลือกคำปันเป็นผู้รับ', 'ย้ายการ์ดในมือมาลีทั้งหมดให้คำปัน', { targets: 2 }),
    card('Scapegoat', 'เลือกมาลีเป็นต้นทาง แล้วเลือกคำปันเป็นปลายทาง', 'ย้ายการ์ดที่วางหน้ามาลีไปหน้าคำปัน · ไม่ย้ายการ์ดชีวิต', { targets: 2 }),
    card('Black Cat', 'เล่นเครื่องเซ่นไว้หน้าตัวเอง', 'เครื่องเซ่นอยู่หน้าคุณ · ผู้ถือเริ่มก่อนและมีผลกับพิธีเซ่นไหว้', { targets: 0 }),
    card('Asylum', 'วางที่หลบภัยให้มาลี', 'มาลีได้รับการป้องกันการสังหารกลางคืน และไม่จำเป็นต้องสารภาพ'),
    card('Matchmaker', 'มาลีมีผูกวิญญาณอยู่แล้ว วางอีกใบให้คำปัน', 'มาลีกับคำปันถูกผูกวิญญาณ · คนใดตาย อีกคนตายตาม', { match: true }),
    { id: 'end-turn', chapter: 'ชาวบ้าน · จบเทิร์น', role: 'ชาวบ้าน', phase: 'กลางวัน', kind: 'end',
        title: 'หลังเล่นการ์ด', prompt: 'แตะจบเทิร์น 2 ครั้งเพื่อยืนยัน', result: 'เล่นการ์ดแล้วจึงจบเทิร์นได้ · ถ้าเลือกจั่ว ระบบจบให้เอง' },
    { id: 'infection', chapter: 'ลองเป็นปอบ', role: 'ชาวบ้าน', phase: 'กลางวัน', kind: 'infection', card: 'Conspiracy',
        title: 'จั่วได้พิธีเซ่นไหว้', prompt: 'แตะกองจั่ว แล้วทำขั้นตอนเลือกการ์ดชีวิต',
        result: 'คุณได้รับการ์ดปอบจากมาลี จึงรู้จักเธอก่อน · ส่งการ์ดต่อก็ยังเป็นทีมปอบ' },
    { id: 'night-event', chapter: 'ลองเป็นปอบ', role: 'ปอบ', phase: 'กลางวัน', kind: 'night', card: 'Night',
        title: 'จั่วได้ยามวิกาล', prompt: 'แตะกองจั่วเพื่อเข้าสู่กลางคืน',
        result: 'เข้าสู่กลางคืน · ตอนนี้คุณรู้จักทุกคนที่เคยเป็นปอบ และจะจำพวกเขาตลอดเกม' },
    { id: 'witch-kill', chapter: 'ลองเป็นปอบ', role: 'ปอบ', phase: 'กลางคืน', kind: 'witch', card: 'Witch',
        title: 'มาร์คก่อน ฆ่าทีหลัง', prompt: 'มาร์คคำปัน → กดฆ่า → ยืนยันอีกครั้ง',
        result: 'ทีมปอบยืนยันเป้าหมายแล้ว แต่ยังไม่ประกาศคนตายจนผ่านช่วงสารภาพ' },
    { id: 'healer', chapter: 'ลองเป็นหมอผี', role: 'หมอผี', phase: 'กลางคืน', kind: 'healer', card: 'Constable',
        title: 'เลือกคนที่จะปกป้อง', prompt: 'ทีมปอบเลือกคำปันไว้ เลือกปกป้องคำปัน แล้วกดยืนยัน',
        result: 'หมอผีปกป้องคำปันสำเร็จ · การโจมตีกลางคืนครั้งนี้ไม่ทำให้เขาตาย' },
    { id: 'confess', chapter: 'ก่อนรุ่งสาง', role: 'ชาวบ้าน', phase: 'ก่อนรุ่งสาง', kind: 'confess',
        title: 'สารภาพหรือข้าม', prompt: 'ฉากนี้คุณถูกเลือกฆ่า ลองสารภาพโดยเปิดการ์ดชีวิตชาวบ้าน 1 ใบ',
        result: 'คุณเสียการ์ดชีวิต 1 ใบเพื่อรอดจากการโจมตีคืนนี้ · ข้ามได้ แต่จะไม่ได้การป้องกันจากการสารภาพ' },
    { id: 'dawn', chapter: 'วันใหม่', role: 'ชาวบ้าน', phase: 'ก่อนรุ่งสาง', kind: 'dawn',
        title: 'เช้าแล้ว', prompt: 'กดเริ่มวันใหม่เพื่อดูการเตรียมกองจั่ว',
        result: 'นำกองทิ้งกลับเข้ากองจั่ว สับใหม่ และวางยามวิกาลไว้ท้ายกอง ก่อนเริ่มเทิร์นใหม่' },
    { id: 'reveal-witch', chapter: 'จบเกม', role: 'ชาวบ้าน', phase: 'กลางวัน', kind: 'reveal', card: 'Witch',
        title: 'เปิดพบปอบตัวสุดท้าย', prompt: 'มาลีถูกกล่าวหาครบแล้ว เลือกเปิดการ์ดชีวิตของเธอ',
        result: 'เปิดพบปอบ → มาลีตายทันที → ไม่มีการ์ดปอบซ่อนเหลือและยังมีชาวบ้านรอด: ชาวบ้านชนะ' },
];

export function createScene(lesson) {
    const players = ['คุณ', 'มาลี', 'คำปัน', 'แก้ว'].map((name, id) => ({
        id, name, alive: true, hand: 2, life: 5, effects: [], accusations: [],
    }));
    if (lesson.card === 'Curse' || lesson.protection) players[1].effects = ['Piety'];
    if (lesson.card === 'Alibi') players[1].accusations = ['Accusation', 'Evidence', 'Accusation'];
    if (lesson.card === 'Scapegoat') { players[1].effects = ['Piety', 'Stocks']; players[1].accusations = ['Evidence']; }
    if (lesson.match) players[1].effects = ['Matchmaker'];
    return { players, deck: 12, discard: lesson.kind === 'dawn' ? 8 : 0, phase: lesson.phase, role: lesson.role,
        knownWitches: lesson.role === 'ปอบ' ? (lesson.phase === 'กลางคืน' ? [1, 3] : [1]) : [] };
}

export function applyTrainingCard(scene, card, ids, selectedCards = []) {
    const target = scene.players[ids[0]];
    const recipient = scene.players[ids[1]];
    const red = { Accusation: 1, Evidence: 3, Witness: 7 };
    if (!['Black Cat'].includes(card) && (!target?.alive || target.id === 0)) return false;
    if (['Robbery', 'Scapegoat'].includes(card) && (!recipient?.alive || recipient.id === 0 || recipient.id === target.id)) return false;
    if (red[card]) {
        if (!target?.alive || target.id === 0 || target.effects.includes('Piety')) return false;
        target.accusations.push(card);
    } else if (card === 'Curse') {
        target.effects = target.effects.filter((name, index) => !selectedCards.includes(index));
    } else if (card === 'Alibi') {
        target.accusations = target.accusations.filter((name, index) => !selectedCards.includes(index));
    } else if (card === 'Arson') { scene.discard += target.hand; target.hand = 0; }
    else if (card === 'Robbery') { recipient.hand += target.hand; target.hand = 0; }
    else if (card === 'Scapegoat') {
        recipient.effects.push(...target.effects); recipient.accusations.push(...target.accusations);
        target.effects = []; target.accusations = [];
    } else if (card === 'Black Cat') scene.players[0].effects.push(card);
    else target.effects.push(card);
    scene.players[0].hand--;
    if (card === 'Curse' || card === 'Alibi') scene.discard += selectedCards.length;
    scene.discard += ['Curse', 'Alibi', 'Arson', 'Robbery', 'Scapegoat'].includes(card) ? 1 : 0;
    return true;
}
