const isNonEmpty = value => !!value && String(value).trim().length > 0;

const isContactFullyRegistered = contact => {
	if (!contact) return false;
	return (
		isNonEmpty(contact.name) &&
		isNonEmpty(contact.email) &&
		isNonEmpty(contact.document) &&
		isNonEmpty(contact.address) &&
		isNonEmpty(contact.contact2)
	);
};

export default isContactFullyRegistered;
