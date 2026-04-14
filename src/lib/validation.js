export const MIN_USERNAME_LEN = 3;
export const MIN_PASSWORD_LEN = 6;
export const USERNAME_REGEX = /^[a-z0-9_]+$/;

export const ERR_USERNAME_MIN = `Mínimo ${MIN_USERNAME_LEN} caracteres`;
export const ERR_USERNAME_FORMAT = 'Solo letras, números y _';
export const ERR_PASSWORD_MIN = `Contraseña mín. ${MIN_PASSWORD_LEN} caracteres`;

export const normalizeUsername = (username) => String(username || '').trim().toLowerCase();

export const validateRegisterInput = (username, password) => {
  const cleanUsername = normalizeUsername(username);
  const cleanPassword = String(password || '');

  if (cleanUsername.length < MIN_USERNAME_LEN) {
    return ERR_USERNAME_MIN;
  }

  if (!USERNAME_REGEX.test(cleanUsername)) {
    return ERR_USERNAME_FORMAT;
  }

  if (cleanPassword.length < MIN_PASSWORD_LEN) {
    return ERR_PASSWORD_MIN;
  }

  return '';
};
