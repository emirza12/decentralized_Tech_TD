function timeout(seconds) {
    return (req, res, next) => {
        const timeoutId = setTimeout(() => {
            res.status(503).json({
                error: "Service temporarily unavailable",
                message: "Request timeout"
            });
        }, seconds * 1000);

        res.on('finish', () => {
            clearTimeout(timeoutId);
        });

        next();
    };
}

module.exports = timeout; 