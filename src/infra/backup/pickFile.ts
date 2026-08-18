// 跨端文件选择：让用户选择一个 JSON 备份文件，返回文件文本内容。

export function pickJsonFile(): Promise<string> {
  // #ifdef H5
  return pickJsonFileH5();
  // #endif

  // #ifdef MP-WEIXIN
  return pickJsonFileMpWeixin();
  // #endif

  // #ifdef APP-PLUS
  return pickJsonFileApp();
  // #endif
}

// —— H5 实现：动态创建 input[type=file] ——
function pickJsonFileH5(): Promise<string> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';
    document.body.appendChild(input);

    let settled = false;
    const cleanup = () => {
      try {
        document.body.removeChild(input);
      } catch {
        /* noop */
      }
      window.removeEventListener('focus', onFocus);
    };

    // 监听 focus：用户取消选择时不会触发 change，监听 focus 来判定取消
    const onFocus = () => {
      setTimeout(() => {
        if (!settled) {
          settled = true;
          cleanup();
          reject(new Error('cancelled'));
        }
      }, 500);
    };

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error('cancelled'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        settled = true;
        cleanup();
        resolve(String(reader.result ?? ''));
      };
      reader.onerror = () => {
        settled = true;
        cleanup();
        reject(reader.error);
      };
      reader.readAsText(file, 'utf-8');
    });

    window.addEventListener('focus', onFocus);
    input.click();
  });
}

// —— 小程序实现 ——
function pickJsonFileMpWeixin(): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // @ts-expect-error wx 在小程序运行时可用
      wx.chooseMessageFile({
        count: 1,
        type: 'file',
        extension: ['json'],
        success: (res: { tempFiles: { path: string; size: number }[] }) => {
          const tempPath = res.tempFiles?.[0]?.path;
          if (!tempPath) {
            reject(new Error('no_file'));
            return;
          }
          // @ts-expect-error wx 在小程序运行时可用
          const fs: WechatMiniprogram.FileSystemManager = wx.getFileSystemManager();
          fs.readFile({
            filePath: tempPath,
            encoding: 'utf-8',
            success: (r: { data: string | ArrayBuffer }) => resolve(String(r.data)),
            fail: (err: unknown) => reject(err),
          });
        },
        fail: (err: unknown) => reject(err),
      });
    } catch (e) {
      reject(e);
    }
  });
}

// —— APP 实现 ——
function pickJsonFileApp(): Promise<string> {
  // 5+App 没有标准的"选择文件"弹窗，需要使用 plus.io.chooseFile（部分版本）
  // 简化：先用 promise 包装，调用方在 APP 端可降级到"导入文本"输入框
  return Promise.reject(new Error('app_pick_not_implemented'));
}
