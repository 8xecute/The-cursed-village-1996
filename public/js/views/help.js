import { client } from '../core/client.js';

export function initialize() {
  const picker = document.getElementById('guide-picker');
  document.getElementById('show-guide-picker-btn').onclick = () => picker.showModal();
  document.getElementById('guide-picker-close').onclick = () => picker.close();
  for (const [buttonId, modalId] of [['show-cards-btn','card-explain-modal'],['show-rules-btn','game-rules-modal']]) {
      document.getElementById(buttonId).addEventListener('click', () => {
          picker.close(); document.getElementById(modalId).style.display = 'flex';
      }, {capture:true});
  }

  client.state.cardNameMap = {
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

  document.addEventListener('DOMContentLoaded', function() {
    const showRulesBtn = document.getElementById('show-rules-btn');
    const rulesModal = document.getElementById('game-rules-modal');
    const closeRulesModal = document.getElementById('close-rules-modal');
    if (showRulesBtn && rulesModal && closeRulesModal) {
      showRulesBtn.onclick = function() {
        rulesModal.style.display = 'flex';
      };
      closeRulesModal.onclick = function() {
        rulesModal.style.display = 'none';
      };
      window.addEventListener('click', function(event) {
        if (event.target === rulesModal) {
          rulesModal.style.display = 'none';
        }
      });
    }
  });

  document.addEventListener('DOMContentLoaded', function() {
    const showCardsBtn = document.getElementById('show-cards-btn');
    const cardsModal = document.getElementById('card-explain-modal');
    const closeCardsModal = document.getElementById('close-cards-modal');
    if (showCardsBtn && cardsModal && closeCardsModal) {
      showCardsBtn.onclick = function() {
        cardsModal.style.display = 'flex';
      };
      closeCardsModal.onclick = function() {
        cardsModal.style.display = 'none';
      };
      window.addEventListener('click', function(event) {
        if (event.target === cardsModal) {
          cardsModal.style.display = 'none';
        }
      });

      // Category Filter Pills Handler
      const filterPills = cardsModal.querySelectorAll('.card-filter-pill');
      const cardItems = cardsModal.querySelectorAll('.card-explain-card');
      filterPills.forEach(function(pill) {
        pill.addEventListener('click', function() {
          filterPills.forEach(function(p) { p.classList.remove('active'); });
          pill.classList.add('active');
          const filterVal = pill.getAttribute('data-filter');
          cardItems.forEach(function(card) {
            if (filterVal === 'all' || card.getAttribute('data-cat') === filterVal) {
              card.style.display = 'flex';
            } else {
              card.style.display = 'none';
            }
          });
        });
      });
    }
  });

  (function() {
    let tooltipDiv = null;
    function showTooltip(e) {
      const text = this.getAttribute('title');
      if (!text) return;
      this.setAttribute('data-original-title', text);
      this.removeAttribute('title');
      if (!tooltipDiv) {
        tooltipDiv = document.createElement('div');
        tooltipDiv.className = 'custom-tooltip';
        document.body.appendChild(tooltipDiv);
      }
      tooltipDiv.textContent = text;
      tooltipDiv.classList.add('show');
      // Always show above the card
      const rect = this.getBoundingClientRect();
      const scrollY = window.scrollY || window.pageYOffset;
      const scrollX = window.scrollX || window.pageXOffset;
      const margin = 8;
      // Temporarily show to get height
      tooltipDiv.style.top = '0px';
      tooltipDiv.style.left = '0px';
      const tooltipRect = tooltipDiv.getBoundingClientRect();
      let top = rect.top + scrollY - tooltipRect.height - margin;
      let left = rect.left + scrollX + rect.width/2 - tooltipRect.width/2;
      // Clamp top
      if (top < scrollY) top = scrollY + margin;
      // Clamp left/right
      if (left < scrollX) left = scrollX + margin;
      if (left + tooltipRect.width > window.innerWidth + scrollX) {
        left = window.innerWidth + scrollX - tooltipRect.width - margin;
      }
      tooltipDiv.style.top = top + 'px';
      tooltipDiv.style.left = left + 'px';
    }
    function hideTooltip(e) {
      if (this.getAttribute('data-original-title')) {
        this.setAttribute('title', this.getAttribute('data-original-title'));
        this.removeAttribute('data-original-title');
      }
      if (tooltipDiv) {
        tooltipDiv.classList.remove('show');
        tooltipDiv.textContent = '';
      }
    }
    document.addEventListener('mouseover', function(e) {
      let el = e.target;
      while (el && el !== document.body) {
        if (el.hasAttribute('title')) {
          showTooltip.call(el, e);
          el.addEventListener('mouseleave', hideTooltip, { once: true });
          break;
        }
        el = el.parentElement;
      }
    });
  })();

  client.dom.drawCardButton.setAttribute('title', 'เมื่อจั่วการ์ดแล้วจบเทิร์นทันที');

  client.dom.playCardButton.setAttribute('title', 'เลือกการ์ดในมือก่อนแล้วกดปุ่มนี้เพื่อใช้การ์ด');

  client.dom.endTurnButton.setAttribute('title', 'กดปุ่มนี้เพื่อจบเทิร์นหลังเล่นการ์ด');

  document.addEventListener('DOMContentLoaded', () => {
      const overlay = document.getElementById('music-overlay');
      const enterBtn = document.getElementById('enter-village-btn');
      // แสดง overlay เฉพาะหน้าแรก (ก่อน join/create lobby)
      let hasEnteredVillage = false;
      try { hasEnteredVillage = sessionStorage.getItem('villageEntered') === 'true' || !!sessionStorage.getItem('currentRoomName'); } catch (_) {}
      if (overlay && hasEnteredVillage) overlay.style.display = 'none';
      if (overlay) {
          // Hide overlay permanently afterเข้า lobby ครั้งแรก
          window.hideMusicOverlayIfNeeded = function(phase) {
              if (phase) {
                  overlay.style.display = 'none';
                  hasEnteredVillage = true;
                  try { sessionStorage.setItem('villageEntered', 'true'); } catch (_) {}
              }
          };
      }
      if (overlay && enterBtn) {
          enterBtn.addEventListener('click', () => {
              try { sessionStorage.setItem('villageEntered', 'true'); } catch (_) {}
              overlay.style.opacity = '0';
              setTimeout(() => overlay.style.display = 'none', 500);
              //               client.actions.startMusic?.();
hasEnteredVillage = true;
          });
      }
      // ถ้า reload แล้วอยู่ใน lobby/game ไม่ต้องแสดง overlay
      client.state.socket.on('room state update', (roomState) => {
          if (window.hideMusicOverlayIfNeeded) {
              window.hideMusicOverlayIfNeeded(roomState.currentPhase);
          }
      });
  });
}
