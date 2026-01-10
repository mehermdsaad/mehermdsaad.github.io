console.log("Type of CryptoJS at decrypt.js start:", typeof CryptoJS);

document.addEventListener('DOMContentLoaded', () => {
    const privateContentSection = document.getElementById('private-content-section');
    const passwordForm = document.getElementById('password-form');
    const passwordInput = document.getElementById('password-input');
    const privateContentContainer = document.getElementById('private-content-container');

    // Modal elements
    const postModal = document.getElementById('postModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    const closeModal = document.getElementById('closeModal');

    if (!privateContentSection || !passwordForm || !privateContentContainer) {
        return;
    }

    // Event listener for closing the modal
    if (closeModal) {
        closeModal.addEventListener('click', () => {
            if (postModal) postModal.style.display = 'none';
        });
    }
    // Close modal if clicking outside
    if (postModal) {
        window.addEventListener('click', (event) => {
            if (event.target == postModal) {
                postModal.style.display = 'none';
            }
        });
    }

    passwordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = passwordInput.value;
        if (!password) {
            alert('Please enter a password.');
            return;
        }

        try {
            const response = await fetch('/data/private.json');
            if (!response.ok) {
                throw new Error('Could not load private posts data.');
            }
            const data = await response.json();
            
            const decryptedPosts = decryptPosts(data.posts, password);

            const successfullyDecryptedCount = decryptedPosts.filter(p => p.content !== null).length;

            if (data.posts.length > 0 && successfullyDecryptedCount === 0) {
                alert('Incorrect password.');
            } else {
                passwordForm.style.display = 'none';
                
                if (successfullyDecryptedCount > 0) {
                    await displayPosts(decryptedPosts.filter(p => p.content !== null));
                } else {
                    privateContentContainer.innerHTML = '<p>No private posts to display or all failed decryption.</p>';
                }
            }

        } catch (error) {
            console.error('Decryption failed:', error);
            alert('An error occurred during decryption: ' + error.message);
        }
    });

    function decryptPosts(posts, password) {
        return posts.map(post => {
            try {
                let decrypted = {};

                // Decrypt content
                const bytesContent = CryptoJS.AES.decrypt(post.content, password);
                if (bytesContent.sigBytes === 0) {
                    console.warn(`Failed to decrypt content. Incorrect password or corrupted data.`);
                    return { ...post, content: null };
                }
                decrypted.content = bytesContent.toString(CryptoJS.enc.Utf8);

                // Decrypt title
                const bytesTitle = CryptoJS.AES.decrypt(post.title, password);
                decrypted.title = bytesTitle.toString(CryptoJS.enc.Utf8);
                if (bytesTitle.sigBytes === 0 || !decrypted.title) {
                     console.warn(`Failed to decrypt title. Incorrect password or corrupted data.`);
                     return { ...post, content: null };
                }

                // Decrypt date
                const bytesDate = CryptoJS.AES.decrypt(post.date, password);
                decrypted.date = bytesDate.toString(CryptoJS.enc.Utf8);
                if (bytesDate.sigBytes === 0 || !decrypted.date) {
                     console.warn(`Failed to decrypt date. Incorrect password or corrupted data.`);
                     return { ...post, content: null };
                }

                // Decrypt permalink (not used for direct link, but for consistency and potential future use)
                const bytesPermalink = CryptoJS.AES.decrypt(post.permalink, password);
                decrypted.permalink = bytesPermalink.toString(CryptoJS.enc.Utf8);
                if (bytesPermalink.sigBytes === 0 || !decrypted.permalink) {
                     console.warn(`Failed to decrypt permalink. Incorrect password or corrupted data.`);
                     return { ...post, content: null };
                }

                return decrypted; // Return the fully decrypted post object
            } catch (e) {
                console.error(`Error during decryption:`, e);
                return { ...post, content: null }; // Mark as failed
            }
        });
    }

    async function displayPosts(postsToDisplay) {
        const publicPostList = document.querySelector('.main .post-list');
        const privatePostsHtml = [];

        for (const post of postsToDisplay) {
            const truncatedContent = post.content.substring(0, 250);
            const postHtml = `
                <article class="post-entry">
                    <header class="entry-header">
                        <h2>${post.title} <sup style="color: red;">[Private]</sup></h2>
                    </header>
                    <div class="entry-content">
                        <p>${truncatedContent}...</p>
                    </div>
                    <footer class="entry-footer">
                        <span>${new Date(post.date).toLocaleDateString()}</span>
                        <button class="read-more-private" data-full-content="${encodeURIComponent(post.content)}" data-title="${encodeURIComponent(post.title)}" style="margin-left: 10px; padding: 5px 10px; background-color: #007bff; color: white; border: none; border-radius: 3px; cursor: pointer;">Read more...</button>
                    </footer>
                </article>
            `;
            privatePostsHtml.push({ html: postHtml, date: new Date(post.date) });
        }

        const existingPublicPosts = publicPostList ? Array.from(publicPostList.children).map(el => {
            const dateSpan = el.querySelector('.entry-footer span');
            return {
                html: el.outerHTML,
                date: dateSpan ? new Date(dateSpan.textContent) : new Date(0)
            };
        }) : [];

        const allPostsCombined = [...existingPublicPosts, ...privatePostsHtml];
        allPostsCombined.sort((a, b) => b.date.getTime() - a.date.getTime());

        if (publicPostList) {
            publicPostList.innerHTML = '';
            allPostsCombined.forEach(item => {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = item.html;
                publicPostList.appendChild(tempDiv.firstElementChild);
            });
        } else {
            privateContentContainer.innerHTML = '';
            allPostsCombined.forEach(item => {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = item.html;
                privateContentContainer.appendChild(tempDiv.firstElementChild);
            });
        }

        // Add event listeners to the new "Read more..." buttons
        document.querySelectorAll('.read-more-private').forEach(button => {
            button.addEventListener('click', (e) => {
                const fullContent = decodeURIComponent(e.target.dataset.fullContent);
                const title = decodeURIComponent(e.target.dataset.title);
                if (modalTitle && modalBody && postModal) {
                    modalTitle.textContent = title;
                    modalBody.innerHTML = fullContent; // Use innerHTML to render markdown if desired, or a markdown parser
                    postModal.style.display = 'block';
                }
            });
        });
    }
});