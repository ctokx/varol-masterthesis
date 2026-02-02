export const createCharacter = ({ name, description, icon, traits, visual_style, purpose }) => ({
    name,
    description,
    icon,
    details: {
        traits,
        visual_style,
        purpose
    }
}); 