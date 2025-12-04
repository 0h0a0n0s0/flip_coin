// 统一的通知系统模块
// 所有前端提示必须通过此模块，禁止直接使用 new Notyf()

let notyfInstance = null;
let notyfDismissReady = false;

/**
 * 初始化 Notyf 实例
 */
function initializeNotyf() {
    if (notyfInstance) return notyfInstance;
    
    notyfInstance = new Notyf({
        duration: 3500,
        position: { x: 'center', y: 'center' },
        ripple: false,
        dismissible: false,
        types: [
            {
                type: 'warning',
                background: 'rgba(0, 0, 0, 0.85)',
                icon: false,
                className: 'notyf-toast'
            },
            {
                type: 'success',
                background: 'rgba(0, 0, 0, 0.85)',
                icon: false,
                className: 'notyf-toast'
            },
            {
                type: 'error',
                background: 'rgba(0, 0, 0, 0.85)',
                icon: false,
                className: 'notyf-toast'
            }
        ]
    });

    // 设置点击外部自动关闭
    const armNotyfDismiss = () => {
        notyfDismissReady = false;
        setTimeout(() => { notyfDismissReady = true; }, 200);
    };
    
    ['success', 'error', 'open'].forEach(method => {
        if (typeof notyfInstance[method] === 'function') {
            const original = notyfInstance[method].bind(notyfInstance);
            notyfInstance[method] = (...args) => {
                armNotyfDismiss();
                return original(...args);
            };
        }
    });

    document.addEventListener('click', (event) => {
        const activeToast = document.querySelector('.notyf__toast');
        if (!activeToast) return;
        if (!notyfDismissReady) return;
        if (event.target.closest('.notyf__toast')) return;
        notyfInstance.dismissAll();
    });

    return notyfInstance;
}

/**
 * 显示成功提示
 */
export function notifySuccess(message) {
    const notyf = initializeNotyf();
    return notyf.success(message);
}

/**
 * 显示错误提示
 */
export function notifyError(message) {
    const notyf = initializeNotyf();
    return notyf.error(message);
}

/**
 * 显示警告提示
 */
export function notifyWarning(message) {
    const notyf = initializeNotyf();
    return notyf.open({
        type: 'warning',
        message: message
    });
}

/**
 * 关闭所有提示
 */
export function dismissAll() {
    if (notyfInstance) {
        notyfInstance.dismissAll();
    }
}

