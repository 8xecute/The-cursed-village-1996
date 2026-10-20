# แผนที่โค้ดและแนวทางบำรุงรักษา

## จุดเริ่มต้น

- `server.js`: เริ่มฟังพอร์ตตาม `PORT` ของ Render
- `src/server/createServer.js`: สร้าง Express, Socket.IO, room store และประกอบ services; ไม่เปิดพอร์ตจนกว่าผู้เรียกจะสั่ง
- `public/script.js`: โหลด browser modules และเรียก initialize ตามลำดับ
- `public/style.css`: รวม CSS ตามลำดับเดิม ลำดับ import มีผลต่อการ override
- `src/client/table3d.js`: ฉาก Three.js ซึ่งโหลดเมื่อเปิดมุมมอง 3D
- `src/client/camera-controls.mjs`: OrbitControls เมาส์/สัมผัส คีย์บอร์ด การเคลื่อนกล้อง มุมที่นั่ง และการถอด input listeners
- `src/client/graphics-quality.mjs`: presets ต่ำ/กลาง/สูง ความละเอียด เงา แสงเสริม และการเปลี่ยนคุณภาพขณะเล่น โดยไม่จำกัด framerate

## เซิร์ฟเวอร์

`src/server/config.js` เก็บจำนวนผู้เล่น ระยะเวลาเฟส และข้อมูลการ์ดที่ใช้กับ UI/validation
`src/shared/cards.js` เป็นแหล่งสร้างสำรับตามจำนวนผู้เล่น

### กติกาใน `src/server/game/`

- `rooms.js`: รายการห้อง ลบห้องและเก็บกวาดทรัพยากร การออกจากห้องและย้ายหัวห้อง
- `reconnection.js`: คืนสมาชิก Socket.IO ส่งข้อมูลส่วนตัวและ prompt ที่ค้างให้ผู้เล่น/ผู้ชมที่กลับเข้าเกม
- `replacement-bots.js`: บอทรับช่วงที่นั่ง และคืนการควบคุมหลังจบแอ็กชัน
- `state.js`: สร้างข้อมูลเฉพาะผู้รับ ซ่อนข้อมูลลับ จำทีมปอบ และ broadcast สถานะ
- `deck.js`: สับสำรับ เตรียมกองจั่ววันใหม่ และแจ้งจำนวนกองจั่ว/กองทิ้ง
- `draw.js`: จั่วการ์ด พักเมื่อเกิดเหตุการณ์ และจั่วต่อให้ครบเทิร์นเดิม
- `cards.js`: ตรวจสิทธิ์/เป้าหมายก่อนเล่น จัดการใช้ไพ่และจบแอ็กชัน รวมถึงกฎนำการ์ดออกเมื่อเหลือผู้เล่น 2 คน
- `card-effects/`: ผลการ์ดรายใบ; index ส่ง context ไปยัง handler หลังผ่านการตรวจส่วนกลางแล้ว ถ้า handler คืน true แปลว่าจัดการการใช้ไพ่/ขั้นตอนค้างเองแล้ว ไม่ให้ส่วนกลางใช้ไพ่ซ้ำ
- `red-cards.js`: กฎการ์ดแดงร่วมสำหรับใบเดียว/หลายใบและบอท ตรวจแต้มต่อแอ็กชัน และเริ่มเลือกเปิดชีวิตได้ครั้งละ 1 ใบ; `playCard` ส่งการ์ดแดงเข้าที่นี่ก่อนใช้ผลการ์ดอื่น
- `turns.js`: ลำดับเทิร์น ข้ามเทิร์นและตรวจการจบเทิร์น
  - `pendingActionReason` เป็นรายการแอ็กชันค้างร่วม; `canAdvanceTurn` ป้องกันการเปลี่ยนเทิร์นระหว่างเหตุการณ์และนอกช่วงกลางวัน
  - ทุกเส้นทางเข้า `setNextTurn` ผ่านตัวตรวจนี้; หลังแอ็กชันเสร็จใช้ `finishEmptyHandTurn` เพื่อจบเมื่อมือหมดหรือผู้เล่นเจ้าของเทิร์นตาย
- `phases.js`: เริ่มเกม เปลี่ยนเฟสและเวลาเฟส
- `life-setup.js`: ช่วง SETUP ก่อนมอบเครื่องเซ่น สับ/แจกชีวิตทีละใบวนที่นั่ง เก็บสำรับไว้ฝั่งเซิร์ฟเวอร์ รอทุกคนจัดตำแหน่งและยืนยัน; รับ swap เฉพาะช่วง arrange และก่อนยืนยัน พร้อม setup id ป้องกันคำสั่งจากรอบเก่า
- `night.js`: สรุปผลการสังหาร/ป้องกันตอนกลางคืน
- `confession.js`: สารภาพ ข้ามเวลา และเปิดการ์ดชีวิต
- `life-cards.js`: ตรวจ/เปิดชีวิต บันทึกไพ่ที่เปิด ส่งข้อมูลชีวิต และจัดการผลบทบาท/ชีวิตหมดร่วมกัน; ผู้เรียกยังดูแลการล้างข้อกล่าวหาและลำดับดำเนินเหตุการณ์ต่อ ส่วนการตาย/ผูกวิญญาณ/ชัยชนะใช้ `outcome.js`
- `conspiracy.js`: เริ่มขั้นตอนเลือกการ์ดจากผู้เล่นซ้ายมือ
- `outcome.js`: ผู้เล่นตาย การ์ดชีวิตหมด เงื่อนไขชนะและสรุปจบเกม

### Socket events ใน `src/server/socket/`

แบ่งตาม `rooms`, `cards`, `phases`, `confession`, `night`, `conspiracy`, `chat`
แต่ละไฟล์ลงทะเบียน handlers ของตัวเอง; `index.js` ประกอบเข้ากับ connection
การรับข้อมูลและตรวจสิทธิ์ของ event อยู่ในหมวดนี้ ส่วนกติกาที่นำกลับมาใช้ได้อยู่ใน game services

- `rooms.js` ประกอบ registrar ใน `rooms/` ตามลำดับเดิม: `identity` (ลงทะเบียน/ชื่อ), `membership` (สร้าง/เข้าห้อง/ผู้ชม), `lobby` (ตั้งค่า/บอท/เริ่มรอบใหม่), `connection` (ออกห้อง/หลุด/รอเชื่อมต่อ)
- `cards.js` ประกอบ `card-effects/curse.js` และ `card-effects/alibi.js` สำหรับการเลือกผลการ์ดที่รอคำตอบและการยกเลิก

Services รับ `game` ผ่าน factory โดย `game` มี `io`, `rooms`, config และ methods จาก services ทั้งหมด
การลบห้องต้องผ่าน `game.deleteRoom(roomName)` เพื่อเคลียร์ timer, บอท, สมาชิก Socket.IO และสถานะการเก็บกวาดห้องพร้อมกัน
ให้เรียกข้าม service ผ่าน `game.method()` เพื่อหลีกเลี่ยง circular require
เมื่อเพิ่ม service ให้เพิ่ม factory ใน `createServer.js`; เมื่อเพิ่มหมวด event ให้เพิ่ม registrar ใน `socket/index.js`
ชื่อ Socket events เป็นสัญญาระหว่าง browser, bots และ server ต้องแก้ผู้ส่ง/ผู้รับให้ตรงกัน

## หน้าเว็บใน `public/js/`

- `core/`: identity, session, DOM references และ shared runtime
  - `interaction.js`: ข้อมูลการเลือกและคำสั่งร่วมของ 2D/3D (ผู้เล่น ชีวิต คำสาป ข้อแก้ต่าง และกลางคืน); UI ลงทะเบียนข้อมูล/handler ขณะสร้างหน้าต่าง ไม่อ่านคลาส selected หรือกดปุ่มจำลองเพื่อเลือกบนโต๊ะ 3D
  - การย่อ/ซ่อนหน้าต่างไม่ล้าง selection; เมื่อหน้าต่างถูกถอดจากหน้า session จะหมดอายุ ส่วน DOM ในแผง 3D ยังใช้จัดหน้าตา/ข้อความและแผงยืนยันสังหาร
- `events/`: รับสถานะห้อง ผู้เล่นและ action การ์ดจากเซิร์ฟเวอร์
- `rooms/`: ปุ่มห้อง แชร์ลิงก์และควบคุมห้อง
- `turns/`: จั่ว เล่น และยืนยันจบเทิร์น
- `cards/`: การ์ดในมือ เลือกเป้าหมาย เลือกการ์ดชีวิต Curse, Alibi และพิธีเซ่นไหว้
- `night/`: เลือกเหยื่อ มาร์คทีมปอบ ยืนยันสังหาร ป้องกันและสารภาพ
- `players/`: กระดานผู้เล่น สถานะตาย ผู้ชมและแจ้งเข้าทีมปอบ
- `chat/`: แชททีมปอบ
- `game/`: หน้าสรุปจบเกมและกลับล็อบบี้
- `audio/`: เพลงและระดับเสียง
- `views/`: มือถือ โต๊ะ 3D ข้อความและคู่มือ
  - `life-setup.js`: ภาพสับ/แจก 2D ฝั่งและหน้าที่ส่วนตัว จัดชีวิตด้วยแตะสองใบหรือลาก ยืนยัน/รอครบทุกคน; ใช้ข้อมูล SETUP ร่วมกับการแตะชีวิตบนโต๊ะ 3D
- `training/`: ฉากจำลองฝึกเล่นแบบโต้ตอบ แยกข้อมูลบทฝึก (`lessons.js`) และหน้าจอ/ขั้นตอน (`tutorial.js`) ไม่ใช้ Socket actions ของห้องจริง

`views/action-guide.js` ดูสถานะห้องที่กรองแล้วและหน้าต่างของผู้เล่น เพื่อแสดงคำแนะนำสั้นและแจ้งเตือนเทิร์น โดยไม่แก้กติกาหรือส่ง action แทนผู้เล่น

`views/table3d-actions.js` เชื่อมการกดบนโต๊ะเข้าปุ่มและ handlers เดิมของหน้าเว็บ ผ่าน metadata `data-life-owner`, `data-life-index`, `data-effect-owner` และ `data-unique-id` เมื่อเพิ่มหน้าต่างเลือก action ใหม่ ให้เพิ่ม metadata/ตัวเลือกใน bridge นี้ แทนการเขียนกติกาหรือส่ง Socket events ซ้ำในฉาก Three.js

`core/client.js` มี namespace สามส่วน:

- `client.state`: ข้อมูล session, state จาก server และสถานะ UI ชั่วคราว
- `client.dom`: DOM elements ที่ใช้ร่วมกัน
- `client.actions`: functions ที่เรียกข้ามฟีเจอร์

แต่ละ module ลงทะเบียน actions ตอนโหลด และทำงานที่มีผลข้างเคียงใน `initialize()`
ให้คงลำดับ initialize ใน `public/script.js`: สร้าง socket/DOM/session ก่อนรับ interaction
อย่าประกาศตัวแปรโดยไม่ใช้ const/let หรือเขียน implicit globals เพราะ browser modules ใช้ strict mode
ข้อมูลทีมปอบและสิทธิ์ action ต้องตัดสินจาก server ห้ามให้หน้าเว็บคำนวณข้อมูลลับจากข้อมูลส่วนตัวของผู้อื่น

## CSS ใน `public/css/`

แยก base, cards, board, chat, responsive-board, life-modals, lobby, mobile,
ready, summary, card-help, navigation, profile, rules, night, action-overlays, death และ spectator
ส่วน page-music, page-intro และ page-help เป็นสไตล์ที่ย้ายออกจาก HTML และยัง override หลังสไตล์หลักตามเดิม
แก้ไฟล์ตามหน้าที่ก่อนเพิ่ม override; ห้ามสลับ import โดยไม่ตรวจ cascade
`raw-theme.css` เป็นธีมด้านที่โหลดท้ายสุด เก็บสีหลักและรูปแบบเลือกการ์ด/เป้าหมาย โดยใช้กรอบแทนแสงเรือง
URL ใน CSS อ้างอิงจากตำแหน่งไฟล์ CSS นั้น เช่น `../Background/background.jpg`

## บอทและกติกาที่ใช้งาน

- `src/bots/player.js`: บอทที่สื่อสารผ่าน Socket.IO เช่นเดียวกับผู้เล่น
- กติกาที่ใช้งานจริงอยู่ใน `src/server/game/` และข้อมูลสำรับอยู่ใน `src/shared/cards.js`
- โค้ด legacy และ compatibility entries ถูกลบแล้ว; ใช้ entry ปัจจุบันตามแผนผังนี้

## Build และการตรวจ

- `npm start`: เปิด server; prestart สร้าง bundle 3D
- `npm run dev`: เปิด server ด้วย nodemon
- `npm run build:client`: build bundle 3D (คงชื่อคำสั่งเดิมสำหรับ deploy)
- `npm run health`: ตรวจไฟล์และ syntax ของ modules
- `node scripts/check-witch-night.cjs`: integration check ระบบกลางคืนด้วย server แยกและพอร์ตชั่วคราว

หน้าเว็บที่ server ให้บริการใช้ native ES modules จาก `public/`; webpack ยังสร้าง `dist/` ได้ตามเดิม
Render ใช้คำสั่งติดตั้ง/build/start เดิม ไม่ต้องเพิ่ม service หรือ environment variable
อย่าแก้ `public/table3d.bundle.js` หรือ `node_modules` โดยตรง
การ build/syntax ผ่านยังไม่ยืนยันพฤติกรรมเล่นจริง; ก่อน Production ควรทดสอบครบตั้งแต่ล็อบบี้ถึงจบเกม
