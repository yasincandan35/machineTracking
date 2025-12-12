/**
 * Job Passport Print Utility - TEMİZ VERSİYON
 */

import { PRINT_SCALES } from './constants';

/**
 * Job Passport'u yazdır
 * @param {string} format - 'a4' veya 'a3'
 * @param {string} selectedMachine - 'lemanic1', 'lemanic2', 'lemanic3'
 */
export const printJobPassport = (format, selectedMachine) => {
  const printable = document.querySelector('.printable-content');
  
  if (!printable) {
    alert('Yazdırılacak içerik bulunamadı!');
    return;
  }

  const scale = PRINT_SCALES[format][selectedMachine] || 1.0;
  const pageSize = format.toUpperCase();

  // ÖNCE orijinal değerleri oku (DOM'dan önce)
  const originalSelects = printable.querySelectorAll('select');
  const selectValues = Array.from(originalSelects).map(sel => ({
    value: sel.value,
    text: sel.options[sel.selectedIndex]?.text || ''
  }));

  const originalInputs = printable.querySelectorAll('input[type="number"]');
  const inputValues = Array.from(originalInputs).map(inp => inp.value);

  // İçeriği klonla
  const clone = printable.cloneNode(true);

  // 1. SELECT'leri TEXT'e çevir (DR Blade, DR Blade Açısı Lemanic 2/3)
  const clonedSelects = clone.querySelectorAll('select');
  clonedSelects.forEach((select, index) => {
    const original = selectValues[index] || {};
    const selectedText = original.text || '';
    const isPlaceholder = !selectedText || selectedText === 'Seçiniz' || selectedText === 'X' || selectedText === 'Y';
    
    const span = document.createElement('span');
    span.textContent = isPlaceholder ? '-' : selectedText;
    span.className = select.className;
    span.style.cssText = 'display: inline-block !important; padding: 4px 8px; font-size: 13px; text-align: center !important;';
    
    // Parent container'a da center alignment ekle
    const parent = select.parentElement;
    if (parent && parent.style.display === 'flex') {
      parent.style.justifyContent = 'center';
      parent.style.alignItems = 'center';
    }
    
    select.parentNode.replaceChild(span, select);
  });

  // 2. INPUT'ları TEXT'e çevir (Lemanic 1 DR Blade Açısı V-H değerleri)
  const clonedInputs = clone.querySelectorAll('input[type="number"]');
  clonedInputs.forEach((input, index) => {
    const value = inputValues[index] || input.placeholder || '-';
    
    const span = document.createElement('span');
    span.textContent = value;
    span.style.cssText = 'display: inline-block !important; padding: 4px; font-size: 13px; text-align: center !important; min-width: 30px;';
    input.parentNode.replaceChild(span, input);
  });

  // 3. BOŞ SLOTLARI gizle ama yer kaplasın (pozisyon korunsun)
  const emptySlots = clone.querySelectorAll('[style*="dashed"]');
  emptySlots.forEach(slot => {
    slot.style.cssText = 'visibility: hidden !important; border: none !important; background: transparent !important;' + slot.style.cssText;
    // İçeriği temizle ama boyutu koru
    const content = slot.querySelectorAll('*');
    content.forEach(el => el.style.visibility = 'hidden');
  });

  // 4. TÜM BUTONLARI kaldır
  const buttons = clone.querySelectorAll('button');
  buttons.forEach(btn => btn.remove());
  
  // 5. TÜM KARTLARA ve KATEGORİLERE AGRESİF inline style
  const allCards = clone.querySelectorAll('[draggable="true"]');
  allCards.forEach(card => {
    // Kartın border ve boxShadow değerlerini koru
    const originalBorder = card.style.border;
    const originalBoxShadow = card.style.boxShadow;
    
    // Kartın kendisi
    card.style.cssText = 'overflow: visible !important; height: auto !important; min-height: auto !important; max-height: none !important; display: block !important; visibility: visible !important;' + card.style.cssText;
    
    // Border ve box-shadow'u tekrar uygula (üzerine yazılmasın diye)
    if (originalBorder) card.style.border = originalBorder;
    if (originalBoxShadow) card.style.boxShadow = originalBoxShadow;
    
    // Renk çubuğunu koru
    const colorBar = card.querySelector('[style*="background-image"]');
    if (colorBar) {
      const bgImage = colorBar.style.backgroundImage;
      colorBar.style.cssText = `background-image: ${bgImage} !important; background-size: cover !important; background-position: center !important; background-repeat: no-repeat !important; width: 100% !important; height: 35px !important; display: block !important; visibility: visible !important;` + colorBar.style.cssText;
    }
    
    // Kartın içindeki TÜM div'ler - overflow visible
    const allDivs = card.querySelectorAll('div');
    allDivs.forEach(div => {
      div.style.cssText = 'overflow: visible !important; height: auto !important; max-height: none !important;' + div.style.cssText;
    });
    
    // Kart içindeki tüm kategoriler
    const categories = card.querySelectorAll('.data-category');
    categories.forEach(cat => {
      cat.style.cssText = 'display: block !important; visibility: visible !important; opacity: 1 !important; overflow: visible !important; height: auto !important; max-height: none !important;' + cat.style.cssText;
      
      const label = cat.querySelector('.category-label');
      const valueDiv = cat.querySelector('.category-value');
      
      if (label) {
        label.style.cssText = 'display: block !important; visibility: visible !important; opacity: 1 !important;' + label.style.cssText;
      }
      
      if (valueDiv) {
        valueDiv.style.cssText = 'display: block !important; visibility: visible !important; opacity: 1 !important; overflow: visible !important; height: auto !important;' + valueDiv.style.cssText;
        
        // DR Blade Açısı için ÖNCE özel işlem (override edilmesin)
        const bladeAngleContainer = valueDiv.querySelector('.blade-angle-container');
        if (bladeAngleContainer) {
          bladeAngleContainer.style.cssText = 'display: flex !important; visibility: visible !important; opacity: 1 !important; gap: 5px !important; align-items: center !important;' + bladeAngleContainer.style.cssText;
          
          // Container içindeki tüm span'lar
          const spans = bladeAngleContainer.querySelectorAll('span');
          spans.forEach(span => {
            span.style.cssText = 'display: inline-block !important; visibility: visible !important; opacity: 1 !important; padding: 4px !important;' + span.style.cssText;
          });
          
          // Separator
          const separator = bladeAngleContainer.querySelector('.blade-separator');
          if (separator) {
            separator.style.cssText = 'display: inline-block !important; visibility: visible !important; opacity: 1 !important; font-weight: bold !important;' + separator.style.cssText;
          }
        }
        
        // SONRA diğer elementlere genel style (blade-angle-container'ı atlayarak)
        const allChildren = valueDiv.querySelectorAll('*:not(.blade-angle-container):not(.blade-angle-container *)');
        allChildren.forEach(child => {
          const currentDisplay = window.getComputedStyle(child).display;
          const displayValue = currentDisplay === 'flex' ? 'flex' : 'inline-block';
          child.style.cssText = `display: ${displayValue} !important; visibility: visible !important; opacity: 1 !important; overflow: visible !important; height: auto !important;` + child.style.cssText;
        });
      }
    });
  });
  
  // printable-content ve wrapper'lara da sıfır padding/margin
  const printableContent = clone;
  printableContent.style.cssText = 'padding: 0 !important; margin: 0 !important; background: white !important; border-radius: 0 !important; box-shadow: none !important;' + printableContent.style.cssText;
  printableContent.classList.remove('rounded-xl', 'shadow-lg', 'bg-white');
  
  // w-full div'i bul ve sıfırla
  const wFullDiv = clone.querySelector('.w-full');
  if (wFullDiv) {
    wFullDiv.style.cssText = 'padding: 0 !important; margin: 0 !important; width: auto !important;';
  }
  
  // Header'a inline style ekle
  const header = clone.querySelector('.print-title');
  const headerH2 = clone.querySelector('.print-title h2');
  if (header) {
    header.className = 'print-title';
    header.style.cssText = 'display: block !important; visibility: visible !important; opacity: 1 !important; text-align: center !important; padding: 0 !important; margin: 0 0 8px 0 !important; background: transparent !important;';
  }
  if (headerH2) {
    headerH2.className = '';
    headerH2.style.cssText = 'display: block !important; visibility: visible !important; opacity: 1 !important; font-size: 18px !important; font-weight: bold !important; color: #333 !important; margin: 0 !important; padding: 0 !important;';
  }
  // Header ve content'i wrapper'a al - Header biraz üstte
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'display: flex; flex-direction: column; gap: 30px; align-items: center; padding: 0; margin: 0;';
  
  // Clone içindeki yapıyı yeniden düzenle
  if (header) {
    wrapper.appendChild(header);
  }
  
  const jobContainer = clone.querySelector('.job-passport-container');
  if (jobContainer) {
    wrapper.appendChild(jobContainer);
  }
  
  // Clone'u temizle ve wrapper'ı ekle
  clone.innerHTML = '';
  clone.appendChild(wrapper);
  clone.style.cssText = 'padding: 0 !important; margin: 0 !important;';

  // Print container oluştur
  const printContainer = document.createElement('div');
  printContainer.id = 'job-passport-print';
  printContainer.style.cssText = `
    position: fixed;
    top: -9999px;
    left: -9999px;
    width: 100%;
    background: white;
  `;
  printContainer.appendChild(clone);
  document.body.appendChild(printContainer);
  
  // DOM'un render olmasını bekle (Chrome bug fix)
  printContainer.offsetHeight; // Force reflow
  

  // Print CSS ekle
  const style = document.createElement('style');
  style.id = 'job-passport-print-style';
  style.textContent = `
    @media print {
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      
      @page {
        size: ${pageSize} landscape;
        margin: 0;
      }
      
      /* Her şeyi gizle */
      body > *:not(#job-passport-print) {
        display: none !important;
      }
      
      /* Print sayfası - tam ekran */
      html, body {
        overflow: hidden !important;
      }
      
      /* Print container - sadece tutucu */
      #job-passport-print {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        margin: 0 !important;
        padding: 0 !important;
        display: block !important;
      }
      
      /* printable-content */
      #job-passport-print > * {
        max-width: none !important;
        width: auto !important;
        margin: 0 !important;
        padding: 0 !important;
        display: block !important;
      }
      
      /* Wrapper'ı TAM ORTALA */
      #job-passport-print > * > div[style*="flex-direction: column"] {
        position: absolute !important;
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) scale(${scale}) !important;
        transform-origin: center center !important;
      }
      
      /* Header - scale YOK, sadece ortala, GÖRÜNÜR */
      #job-passport-print .print-title {
        transform: none !important;
        margin-bottom: 0px !important;
        padding: 0px 0 !important;
        text-align: center !important;
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
      }
      
      /* Header içindeki h2 */
      #job-passport-print .print-title h2 {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
      }
      
      /* Tüm elementler görünür + overflow */
      #job-passport-print * {
        visibility: visible !important;
        opacity: 1 !important;
        overflow: visible !important;
      }
      
      /* Kartlar (draggable) - overflow visible + border & box-shadow koru */
      #job-passport-print [draggable="true"] {
        overflow: visible !important;
        max-height: none !important;
        height: auto !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      
      /* Flex layout'ları ZORUNLU koru - GAP dahil */
      #job-passport-print .flex,
      #job-passport-print [class*="flex"],
      #job-passport-print .blade-angle-container,
      #job-passport-print [style*="display: flex"],
      #job-passport-print [style*="display:flex"] {
        display: flex !important;
      }
      
      /* Data category - block + overflow visible */
      #job-passport-print .data-category {
        display: block !important;
        visibility: visible !important;
        overflow: visible !important;
        max-height: none !important;
        height: auto !important;
      }
      
      /* Category label & value - ZORUNLU GÖRÜNÜR + KOYU RENK */
      #job-passport-print .category-label,
      #job-passport-print .category-value {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        height: auto !important;
        max-height: none !important;
        overflow: visible !important;
        color: #000 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      
      /* Category value içindeki TÜMBILGILER - ALT ELEMENTLER */
      #job-passport-print .category-value *,
      #job-passport-print .category-value > *,
      #job-passport-print .category-value div,
      #job-passport-print .category-value span,
      #job-passport-print .category-value > .blade-angle-container,
      #job-passport-print .category-value > .blade-angle-container * {
        display: inline-block !important;
        visibility: visible !important;
        opacity: 1 !important;
        color: #000 !important;
      }
      
      /* Flex container'lar için - CHROME RENDER BUG FIX */
      #job-passport-print .blade-angle-container {
        display: flex !important;
        visibility: visible !important;
        opacity: 1 !important;
        align-items: center !important;
        gap: 5px !important;
        will-change: transform !important;
        backface-visibility: visible !important;
        -webkit-backface-visibility: visible !important;
      }
      
      /* blade-angle-container içindeki SPAN'lar - CHROME FIX */
      #job-passport-print .blade-angle-container span,
      #job-passport-print .blade-angle-container .blade-separator {
        display: inline-block !important;
        visibility: visible !important;
        opacity: 1 !important;
        font-size: 13px !important;
        padding: 4px !important;
        color: #000 !important;
        will-change: opacity !important;
        backface-visibility: visible !important;
        -webkit-backface-visibility: visible !important;
        transform: translateZ(0) !important;
        -webkit-transform: translateZ(0) !important;
      }
      
      /* Resimler */
      #job-passport-print img {
        display: block !important;
      }
      
      /* Renk çubukları - background image koru */
      #job-passport-print [style*="background-image"],
      #job-passport-print [style*="backgroundImage"] {
        background-size: cover !important;
        background-position: center !important;
        background-repeat: no-repeat !important;
      }
      
      /* Span'lar - her zaman görünür + KOYU RENK */
      #job-passport-print span {
        display: inline-block !important;
        visibility: visible !important;
        opacity: 1 !important;
        color: #000 !important;
      }
      
      /* Separator - görünür + KOYU RENK */
      #job-passport-print .blade-separator {
        display: inline-block !important;
        visibility: visible !important;
        color: #000 !important;
      }
      
      /* DR Blade ve açısı - özel görünürlük + KOYU RENK */
      #job-passport-print .blade-select,
      #job-passport-print .blade-angle-select,
      #job-passport-print .blade-angle-input {
        display: inline-block !important;
        visibility: visible !important;
        color: #000 !important;
      }
    }
  `;
  document.head.appendChild(style);

  // Print - DOM'un tamamen hazır olmasını bekle
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        window.print();
        
        // Cleanup
        setTimeout(() => {
          printContainer.remove();
          style.remove();
        }, 100);
      }, 150);
    });
  });
};

