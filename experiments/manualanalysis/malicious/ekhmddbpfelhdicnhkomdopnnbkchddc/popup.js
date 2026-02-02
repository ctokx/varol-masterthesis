function showTip(tip) {
  const node = document.getElementById('tip');
  node && (node.innerHTML = tip);
}

/* eslint-disable-next-line no-undef */
chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
  // 获取当前标签页的 URL
  const currentUrl = tabs[0].url || '';

  /* eslint-disable-next-line no-undef */
  chrome.i18n.getAcceptLanguages(function (languages) {
    const lang = (languages[0] || '').toLowerCase();
    const isZh = lang === 'zh' || lang.startsWith('zh-');
    const hosts = [
      'gemini.google.com',
      'aistudio.google.com'
    ];
    const isFlow = currentUrl.includes('labs.google') && currentUrl.includes('/fx/') && currentUrl.includes('/tools/flow');
    const match = isFlow || hosts.findIndex(host => currentUrl.includes(host)) > -1;
    const host = 'gemini.google.com';
    const website = 'Gemini';
    const host2 = 'aistudio.google.com';
    const website2 = 'AI Studio';
    const host3 = 'labs.google/fx/tools/flow';
    const website3 = 'Flow';
    const links = [
      `<a href="https://${host}" target="_blank" rel="noopener noreferrer">${website}</a>`,
      `<a href="https://${host2}" target="_blank" rel="noopener noreferrer">${website2}</a>`,
      `<a href="https://${host3}" target="_blank" rel="noopener noreferrer">${website3}</a>`
    ].join('/')

    if (match) {
      if (isZh) {
        showTip(
          `点击右侧浮窗图标 <img src="./images/float-icon.jpg" class="icon" /> 打开插件，如果没有浮窗，请尝试刷新页面。<a href="https://docs.autojourney.ai/contact" target="_blank" rel="noopener noreferrer">联系我们</a>。<br /><img src="./images/float-icon-image-cn.jpg" class="image" />`
        );
      } else {
        showTip(
          `Click the floating icon on the right side <img src="./images/float-icon.jpg" class="icon" /> to open the extension. If the floating icon is not visible, please try refreshing the page. <a href="https://docs.autojourney.ai/en-US/contact" target="_blank" rel="noopener noreferrer">Contact us</a>.<br /><img src="./images/float-icon-image-en.jpg" class="image" />`
        );
      }
    } else {
      if (isZh) {
        showTip(
          `插件仅支持在 ${links} 网页版使用，请打开 ${links} 网页版后再试。<a href="https://docs.autojourney.ai/contact" target="_blank" rel="noopener noreferrer">联系我们</a>。`
        );
      } else {
        showTip(
          `The extension is only available on the ${links} website. Please open ${links} and then try again. <a href="https://docs.autojourney.ai/en-US/contact" target="_blank" rel="noopener noreferrer">Contact us</a>.`
        );
      }
    }
  });
});
