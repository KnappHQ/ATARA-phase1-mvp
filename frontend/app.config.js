module.exports = ({ config: base }) => {
  const domain = process.env.EXPO_PUBLIC_PASSKEY_RP_ID;
  if (domain && !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain))
    throw new Error("PASSKEY_RP_ID must be a hostname without https://");
  return {
    ...base,
    ios: {
      ...base.ios,
      ...(domain ? { associatedDomains: [`webcredentials:${domain}`] } : {}),
    },
  };
};
