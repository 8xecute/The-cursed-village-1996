export function initialize() {
  // Popup เนื้อเรื่อง
      const storyModal = document.getElementById('story-modal');
      const showStoryBtn = document.getElementById('show-story-btn');
      const closeStoryModal = document.getElementById('close-story-modal');
      const enterVillageFromStory = document.getElementById('enter-village-from-story');
      if(showStoryBtn && storyModal) {
        showStoryBtn.onclick = () => { storyModal.style.display = 'flex'; document.body.style.overflow = 'hidden'; };
      }
      if(closeStoryModal && storyModal) {
        closeStoryModal.onclick = () => { storyModal.style.display = 'none'; document.body.style.overflow = ''; };
      }
      if(enterVillageFromStory && storyModal) {
        enterVillageFromStory.onclick = () => { storyModal.style.display = 'none'; document.body.style.overflow = ''; };
      }
      // ปิด popup เมื่อกด ESC
      window.addEventListener('keydown', function(e) {
        if (e.key === "Escape" && storyModal.style.display === 'flex') {
          storyModal.style.display = 'none';
          document.body.style.overflow = '';
        }
      });
      // ปิด popup เมื่อคลิกพื้นหลัง
      if(storyModal) {
        storyModal.addEventListener('click', function(e) {
          if (e.target === storyModal) {
            storyModal.style.display = 'none';
            document.body.style.overflow = '';
          }
        });
      }
}
