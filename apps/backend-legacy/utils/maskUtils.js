function maskValue(value = '', front = 4, back = 4) {
    if (!value || typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (trimmed.length <= front + back) {
        return trimmed.replace(/./g, '*');
    }
    return `${trimmed.slice(0, front)}***${trimmed.slice(-back)}`;
}

function maskAddress(address) {
    return maskValue(address, 5, 4);
}

function maskTxHash(txHash) {
    return maskValue(txHash, 6, 6);
}

function maskUserId(userId) {
    return maskValue(userId, 3, 2);
}

module.exports = {
    maskValue,
    maskAddress,
    maskTxHash,
    maskUserId
};

