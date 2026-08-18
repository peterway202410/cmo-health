// 跨端文件下载封装：将文本内容保存到用户设备
// H5 用 Blob + a 标签触发浏览器下载
// 小程序、APP 端通过条件编译切换实现（待补）

export function saveTextFile(filename: string, content: string): Promise<void> {
  // #ifdef H5
  return saveTextFileH5(filename, content);
  // #endif

  // #ifdef MP-WEIXIN
  return saveTextFileMpWeixin(filename, content);
  // #endif

  // #ifdef APP-PLUS
  return saveTextFileApp(filename, content);
  // #endif
}

// —— H5 实现 ——
function saveTextFileH5(filename: string, content: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      // Safari 需要把 a 加进 DOM 才能 click
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // 立即释放可能影响小文件下载，延迟 1s 释放
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      resolve();
    } catch (e) {
      reject(e);
    }
  });
}

// —— 小程序实现（占位）——
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function saveTextFileMpWeixin(filename: string, content: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // 使用 wx 文件系统写入临时文件 + 调起 wx.shareFileMessage 或 wx.openDocument
    // 简化：先把内容写到临时文件供用户长按转发
    // 注意：小程序无法直接触发"下载到本地"，需借助分享或保存到聊天记录
    try {
      // @ts-expect-error wx 在小程序运行时可用
      const fs: WechatMiniprogram.FileSystemManager = wx.getFileSystemManager();
      // @ts-expect-error wx 在小程序运行时可用
      const path = `${wx.env.USER_DATA_PATH}/${filename}`;
      fs.writeFile({
        filePath: path,
        data: content,
        encoding: 'utf-8',
        success: () => {
          // @ts-expect-error wx 在小程序运行时可用
          wx.shareFileMessage({
            filePath: path,
            success: () => resolve(),
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

// —— APP 实现（占位）——
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function saveTextFileApp(filename: string, content: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // 使用 plus.io 写到 _doc 目录，再用 plus.runtime.openFile 让用户分享/查看
    try {
      // @ts-expect-error plus 在 5+App 运行时可用
      plus.io.requestFileSystem(
        // @ts-expect-error plus 在 5+App 运行时可用
        plus.io.PRIVATE_DOC,
        // @ts-expect-error
        (fs) => {
          // @ts-expect-error
          fs.root.getFile(
            filename,
            { create: true },
            // @ts-expect-error
            (entry) => {
              // @ts-expect-error
              entry.createWriter((writer) => {
                writer.onerror = (err: unknown) => reject(err);
                writer.onwrite = () => resolve();
                writer.write(content);
              });
            },
            (err: unknown) => reject(err),
          );
        },
        (err: unknown) => reject(err),
      );
    } catch (e) {
      reject(e);
    }
  });
}
