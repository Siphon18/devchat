/**
 * Returns a DiceBear avatar URL.
 * Uses the 'adventurer' style which has a native sex parameter.
 */
export const getAvatarUrl = (username, gender) => {
    const base = "https://api.dicebear.com/7.x/adventurer/svg";
    const seed = encodeURIComponent(username || "user");

    if (gender === "male") {
        return `${base}?seed=${seed}&sex=male`;
    }
    if (gender === "female") {
        return `${base}?seed=${seed}&sex=female`;
    }
    // neutral — no sex filter, fully random
    return `${base}?seed=${seed}`;
};
