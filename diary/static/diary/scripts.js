// reset selection
function resetSelection(elements, className) {
    elements.forEach(el => el.classList.remove(className));
}

// color click Handle
function updateAvatarColor(option, avatarPreview) {
    const newColor = option.getAttribute("data-color");
    const selectedAnimal = document.querySelector(".selected-icon i");

    avatarPreview.style.color = newColor; // renew color on preview
    document.getElementById("selectedColorInput").value = newColor;
    if (selectedAnimal) selectedAnimal.style.color = newColor; // renew animal icons color

    // renew selected color
    resetSelection(document.querySelectorAll(".color-icon"), "selected-color");
    option.classList.add("selected-color");
}

// animal click Handle
function updateAnimalPreview(icon, avatarIcon, avatarPreview) {
    const newIcon = icon.getAttribute("data-animal");
    const currentColor = document.querySelector(".selected-color").getAttribute("data-color");

    resetSelection(document.querySelectorAll(".animal-icon"), "selected-icon"); // reset selected animal icon

    // renew preview (animal + color)
    icon.classList.add("selected-icon");
    avatarIcon.className = newIcon;
    avatarIcon.style.color = currentColor;

    avatarIcon.style.display = "block"; // show icon
    avatarPreview.style.display = "none"; // hide img

    // renew hidden input
    document.getElementById("selectedIconInput").value = newIcon;
}

// preview click Handle
function updateAvatarImage(input, avatarPreview) {
    const file = input.files[0];
    const avatarIcon = document.getElementById("avatarIcon"); // default icon

    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            avatarPreview.src = e.target.result;
            avatarPreview.style.display = "block"; // show img
            avatarIcon.style.display = "none"; // hide icon
        };
        reader.readAsDataURL(file);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const avatarInput = document.getElementById('avatarInput');
    const colorIcons = document.querySelectorAll(".color-icon"); // colors
    const animalIcons = document.querySelectorAll(".animal-icon"); // animals
    const avatarIcon = document.getElementById("avatarIcon");
    const avatarPreview = document.getElementById("avatarPreview"); // avatar

    // color click Handle
    if(colorIcons){
        colorIcons.forEach(color => {color.addEventListener("click", () => {updateAvatarColor(color, avatarIcon);});});
    }
    // animal click Handle
    if(animalIcons){
        animalIcons.forEach(animal => {animal.addEventListener("click", () => {updateAnimalPreview(animal, avatarIcon, avatarPreview);});});
    }
    // preview click Handle
    if (avatarInput){
        avatarInput.addEventListener('change', function () {updateAvatarImage(this, avatarPreview);});
    }
});