# The Cursed Village 1996 - เอกสารระบบฉบับละเอียด (ภาษาไทย)

เอกสารนี้เป็นไฟล์ handoff เชิงเทคนิคเพื่อใช้บำรุงรักษา แก้บั๊ก และรีแฟคเตอร์ในอนาคต  
เนื้อหาอ้างอิงพฤติกรรมจริงของระบบ ณ เวลาปัจจุบัน

## 1) ภาพรวมสถาปัตยกรรม

### 1.1 เทคโนโลยีหลัก

- Backend: Node.js + Express + Socket.IO
- Frontend: `public/index.html`, `public/script.js`, `public/style.css`
- Build: Webpack (`npm run build:client`) แล้วปล่อยไฟล์ไป `dist/`

### 1.2 ไฟล์สำคัญ

- `server.js`:
  - game engine ฝั่งเซิร์ฟเวอร์ทั้งหมด
  - state ห้อง, turn/phase, card resolution, socket handlers
- `public/script.js`:
  - logic ฝั่ง client, การเรนเดอร์ dashboard, popup, interactions
- `public/style.css`:
  - layout และ responsive
- `docs/SYSTEM_EXPORT_DETAILED.md`:
  - เวอร์ชันภาษาอังกฤษ

### 1.3 รูปแบบการทำงาน

- เซิร์ฟเวอร์เป็น source-of-truth
- ข้อมูลห้องเก็บในหน่วยความจำ (`rooms`) ยังไม่มีฐานข้อมูลถาวร
- Client รับ state ผ่าน socket แล้วแสดงผล

## 2) โครงสร้างข้อมูลหลัก

### 2.1 Room Model (`rooms[roomName]`)

กลุ่มข้อมูลสำคัญ:

- lifecycle:
  - `gameStarted`, `currentPhase`, `dayNumber`, `gameOver`, `winner`
- turn:
  - `currentTurnPlayerUniqueId`
- deck:
  - `gameDeck`, `discardPile`
- accusation / reveal:
  - `accusedPlayers`
  - `playerForcedToRevealTryal`
  - `playerForcedToRevealSelector`
- night:
  - `playersWhoActedAtNight` (`witchKill`, `constableSave`)
  - `confessionOrder`, `currentConfessionIndex`, `nightConfessors`
- conspiracy / black cat:
  - `blackCatHolder`
  - `awaitingConspiracySelection`
  - `awaitingLeftTryalSelections`
  - `conspiracyTryalSelections`
- logs:
  - `gameMessageHistory`
  - `witchChatHistory`
  - `infectionLog`

### 2.2 Player Model (`room.players[uniqueId]`)

- identity:
  - `id`, `uniqueId`, `name`
- game status:
  - `alive`, `connected`, `isHost`
- card state:
  - `hand`, `tryalCards`, `inPlayCards`
  - `revealedTryalCardIndexes`
- role:
  - `isWitch`, `hasBeenWitch`, `isConstable`
- turn constraints:
  - `isSilenced`
  - `hasPlayedCardsThisTurn`

## 3) ลำดับการไหลของ event (Socket)

### 3.1 เข้าระบบ/รีคอนเนกต์

- client register ด้วย `uniqueId`
- ถ้ามีห้องค้างอยู่ จะ `join existing room`
- ถ้าไม่มีห้อง จะขอรายการห้องที่ active

### 3.2 การจัดการห้อง

- สร้างห้อง: `create room`
- เข้าห้อง: `join room`
- ออกจากห้อง: `leave room`
- ขอรายชื่อห้อง: `request rooms list` -> `active rooms list`

### 3.3 การเล่นเกม

- `start game`
- `draw cards`
- `play card`
- `end turn`
- reveal/confession:
  - `confess during night`
  - `confess tryal card`
  - `reveal tryal card`
  - `select tryal card for confession`
- night actions:
  - `witch kill target`
  - `constable action`
- actions แบบมี popup เลือก:
  - `select curse target`
  - `select alibi removal`
  - `select blackcat tryal`
  - `select left tryal`

## 4) กลไก phase / turn

### 4.1 เฟสหลัก

- `LOBBY`
- `DAY`
- `NIGHT`
- `PRE_DAWN`

### 4.2 กลางวัน (DAY)

- เลือกผู้เล่นถัดไปด้วย `setNextTurn(room)`
- ผู้เล่นทำได้: จั่ว / เล่นการ์ด / จบเทิร์น
- event card บางใบจะตัด flow ปกติชั่วคราว

### 4.3 กลางคืน (NIGHT)

- ส่ง prompt ให้ปอบเลือกฆ่า และหมอผีเลือกปกป้อง
- track การส่ง action ผ่าน `playersWhoActedAtNight`
- แก้บั๊กล่าสุดด้วยแนวคิดตรวจ key presence ชัดเจน

### 4.4 ก่อนเช้า (PRE_DAWN)

- จัดลำดับสารภาพ/ข้ามสารภาพ
- สรุปผลกลางคืน -> กลับ DAY

## 5) สรุปการทำงานของการ์ด

### 5.1 การ์ดแดง

- `Accusation` (+1), `Evidence` (+3), `Witness` (+7)
- ใบแดงจะ:
  - เพิ่มแต้มข้อกล่าวหา
  - แปะการ์ดแดงไว้หน้าเป้าหมาย (`inPlayCards`)
  - ถ้าแต้มถึงเกณฑ์ -> บังคับเปิดการ์ดชีวิต

### 5.2 การ์ดน้ำเงิน

- เป็นการ์ดสถานะค้างหน้า (persistent)
- ถูกลบได้ด้วยเอฟเฟกต์บางใบ เช่น `Curse`

### 5.3 การ์ดเขียว

- มักเป็น one-shot action แล้วลงกองทิ้ง
- บางใบเปิด flow เลือกเป้าหมายต่อเนื่อง

### 5.4 การ์ด Event

- เช่น `Night`, `Conspiracy`
- เมื่อถูกจั่วจะ resolve ทันทีและอาจเปลี่ยนเฟส/สถานะรอ

## 6) สัญญาข้อมูลฝั่ง UI

### 6.1 Room state payload

`emitRoomState` ส่ง `inPlayCards` เป็น object:

- `{ name, color, value }`

ฝั่ง client รองรับทั้ง:

- object format ใหม่
- string format แบบ legacy

### 6.2 การแปลไทย

- ใช้ `displayCardName(...)` สำหรับ label
- ใช้ `getCardNameTH(...)` สำหรับข้อมูลที่ไม่แน่นอนชนิด
- ปรับให้รองรับ object แล้ว เพื่อลดปัญหา `[object Object]`

### 6.3 Revealed cards

- ฝั่ง UI รองรับ reveal marker แบบ index และแบบชื่อการ์ด
- ส่วน `Revealed:` แสดงชื่อการ์ดภาษาไทย

## 7) เงื่อนไขจบเกม + recap

### 7.1 เงื่อนไขหลัก

- ทีมปอบชนะทันทีถ้าผู้เล่นที่ยังมีชีวิตอยู่เป็นฝั่งปอบทั้งหมด
- ทีมชาวบ้านชนะเมื่อเงื่อนไขเปิดการ์ดปอบครบตามระบบ
- เสมอเมื่อไม่มีผู้เล่นที่มีชีวิตเหลือ

### 7.2 หน้าจบเกม

- มี popup แสดงผู้ชนะ
- แสดงการ์ดเด่นของทีมที่ชนะ
- แสดง recap การแพร่เชื้อจาก `infectionLog`

## 8) ความเสถียรที่แก้ล่าสุด

- แก้บั๊กผู้เล่น role ซ้อน (ปอบ+หมอผี) ใช้สกิลกลางคืนไม่ได้
- แก้ sync สถานะการ์ดบน dashboard ให้ update หลังลบ/ย้ายการ์ด
- เพิ่ม popup แจ้ง forced reveal กับผู้ถูกบังคับเปิด
- เพิ่มสถานะรอใน flow ที่ต้องให้ผู้เล่นเลือกครบทุกคน
- ปรับ responsive ให้เล่นบนมือถือ/iPad ง่ายขึ้น

## 9) สถานะความปลอดภัย dependency

- ปัจจุบัน `npm audit --json` = 0 vulnerabilities
- แนวทางที่ทำ:
  - อัปเดต dependency ที่เสี่ยง
  - ตัด chain เก่าที่ลากช่องโหว่จำนวนมาก
  - ปรับ script build ให้ไม่ผูกกับ optimizer เก่าที่ไม่เสถียร

## 10) คำสั่งที่ใช้บ่อย

- รัน dev: `npm run dev`
- lint: `npm run lint`
- health: `npm run health`
- build client: `npm run build:client`
- audit: `npm audit --json`

## 11) จุดหนี้เทคนิค (Technical Debt)

- `server.js` ยังใหญ่และรวมหลาย concern
- reveal metadata ยังมีการใช้ทั้ง index/ชื่อร่วมกัน
- socket handler กับ card resolver ยัง coupling สูง
- ไม่มี persistence; รีสตาร์ตเซิร์ฟเวอร์แล้วสถานะห้องหาย

## 12) แผนรีแฟคเตอร์แนะนำ

### ระยะสั้น

- แยก constants และ localization map
- รวมชื่อ event/socket เป็น constants กลาง

### ระยะกลาง

- แตก `server.js` เป็น module:
  - room lifecycle
  - phase engine
  - card resolver
  - socket controller

### ระยะยาว

- ใช้ state machine ชัดเจนสำหรับ phase transitions
- เพิ่ม integration tests สำหรับ flow เสี่ยง

## 13) Test Matrix ที่ควรมี

- กลางคืน:
  - ปอบปกติ
  - หมอผีปกติ
  - ผู้เล่น role ซ้อน (ปอบ+หมอผี)
- การ์ดแดง:
  - สะสมแต้มถึง threshold
  - witness บังคับเปิดทันที
- conspiracy:
  - black-cat reveal
  - left-tryal รอครบทุกคน
- game-over:
  - ทุกคนที่เหลือเป็นปอบ
  - ชาวบ้านชนะ
  - เสมอ

## 14) Troubleshooting แบบเร็ว

- อาการ: กลางคืนกดสกิลไม่ได้
  - ตรวจ key ใน `playersWhoActedAtNight`
  - ตรวจว่ามี prompt ส่งถึง socket ผู้เล่นถูกคนหรือไม่
- อาการ: dashboard ไม่ update
  - ตรวจว่า branch นั้นมี `emitRoomState` หลัง resolve หรือยัง
  - ตรวจว่า client รับ `update in play cards` แล้ว re-render หรือยัง
- อาการ: ข้อความชื่อการ์ดเพี้ยน
  - ตรวจการเรียก helper แปลไทยกับ payload ชนิด object
- อาการ: เฟสค้าง
  - ตรวจ flags ค้าง:
    - `awaitingConspiracySelection`
    - `awaitingLeftTryalSelections`
    - forced reveal pointers

