const hx = require('hbuilderx');
const path = require('path');
const fs = require('fs');
const tinify = require('tinify');

const compress = require('./compress.js');
const notification = require('./notification.js');

// 允许的图片后缀
const imageSuffix = ['.png', '.jpg', '.jpeg'];


/**
 *@description  get Tingypng Config
 */
function getTinyConfig() {
    let config = hx.workspace.getConfiguration();
    let tinyKey = config.get('TinyPng.ApiKey');
    let tingyCompressedFilePostfix = config.get('TinyPng.compressedFilePostfix');
    let tinyForceOverwrite = config.get('TinyPng.forceOverwrite');
    return {
        tinyKey,
        tingyCompressedFilePostfix,
        tinyForceOverwrite
    }
};

/**
 * @description 文件多选
 * @param {Object} param
 */
function MultiSelect(param) {
    return new Promise((resolve, reject) => {
        let isIncludeDirectory = false;
        let fileList = [];
        try {
            for (let v of param) {
                let fsPath = v.fsPath;
                let stats = fs.statSync(fsPath);
                if (stats.isDirectory()) {
                    isIncludeDirectory = true;
                } else {
                    let ext = path.extname(fsPath);
                    if (imageSuffix.includes(ext.toLowerCase())) {
                        let fsize = ((stats.size) / 1024).toFixed(2);
                        fileList.push({
                            'fsPath': fsPath,
                            'imgOriginalSize': fsize
                        })
                    };
                };
            };
            resolve({isIncludeDirectory,fileList});
        } catch (e) {
            reject({isIncludeDirectory,fileList});
        }
    });
};


/**
 * @description 操作一个文件
 * @param {Object} tinyConfig
 * @param {Object} fsPath 文件绝对路径
 */
async function operateOneFile(tinyConfig, fsPath, fstate) {
    let {tinyKey,tingyCompressedFilePostfix,tinyForceOverwrite} = tinyConfig;
    const imgExtname = path.extname(fsPath);
    const imgOriginalSize = ((fstate.size) / 1024).toFixed(2);

    let target = fsPath.slice(0, -imgExtname.length) + tingyCompressedFilePostfix + imgExtname;
    if (tinyForceOverwrite) {
        target = fsPath;
    };
    let info = await compress.tinypngCompress(tinyKey, fsPath, imgOriginalSize, target);
    notification.showMsgBox(info);
};


/**
 * @description 操作多个文件
 * @param {Object} tinyConfig
 * @param {Object} fileList
 */
async function operateMoreFile(tinyConfig, fileList) {
    if (fileList.length === 0) { return };
    let {tinyKey,tingyCompressedFilePostfix,tinyForceOverwrite} = tinyConfig;

    // print msg
    let msg = '当前选中的数据, 检测到 ' + fileList.length + ' 张图片, 开始压缩......';
    const remark = '备注: 受网络、tinypng服务器影响，如操作时间过长，请关闭后重试。\n'
    notification.OutputChannel2(msg);
    notification.OutputChannel2(remark);

    for (let idx in fileList) {
        let {fsPath,imgOriginalSize} = fileList[idx];
        let imgExtname = path.extname(fsPath);
        let target = fsPath.slice(0, -imgExtname.length) + tingyCompressedFilePostfix + imgExtname;
        if (tinyForceOverwrite) {
            target = fsPath;
        };
        let info = await compress.tinypngCompress(tinyKey, fsPath, imgOriginalSize, target);
        info = Object.assign(info, {'imgOriginalSize':imgOriginalSize,'index':parseInt(idx) + 1});
        notification.OutputChannel(info);
    };
};

/**
 * @description 压缩文件
 */
async function Main(param) {

    // get tinypng config
    let tinyConfig = getTinyConfig();
    let {tinyKey,tingyCompressedFilePostfix,tinyForceOverwrite} = tinyConfig;
    if (tinyKey.replace(/\s*/g, "") == '' | tinyKey == undefined) {
        return hx.window.showErrorMessage("TinyPNG: 请在菜单【设置 - 插件设置】中填写有效的ApiKey");
    };
    if (tinyForceOverwrite && tingyCompressedFilePostfix.replace(/\s*/g, "") == '') {
        return hx.window.showErrorMessage("TinyPNG: 请填写压缩后的图片名称后缀，比如.min");
    };

    // 判断用户选择的数据
    if (param.constructor === Object) {
        let fsPath = param.fsPath;
        let stats = fs.statSync(fsPath);
        if (stats.isDirectory()) {

        };
        if (stats.isFile()) {
            operateOneFile(tinyConfig, fsPath, stats);
        };
    } else if (param.constructor === Array) {
        let {
            isIncludeDirectory,
            fileList
        } = await MultiSelect(param);

        // 多选且包含目录，则询问用户操作
        if (isIncludeDirectory) {
            const msg =
                'TinyPNG: 多选的数据中，同时检测到目录和文件，如继续，将忽略目录。<p style="color:#787878;font-size:13px;">备注: 如需按目录压缩，请直接选中目录。</p><p></p>'
            hx.window.showErrorMessage(msg, ['继续', '停止']).then((result) => {
                if (result == '停止') {
                    return;
                } else {
                    operateMoreFile(tinyConfig, fileList);
                }
            });
        } else {
            operateMoreFile(tinyConfig, fileList);
        };

    } else {
        hx.window.showInformationMessage('选中一个文件或目录后再进行操作。', ['知道了']);
        return;
    };

};

module.exports = {
    Main
}
