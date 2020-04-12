/**
 * Bio component that queries for data
 * with Gatsby's useStaticQuery component
 *
 * See: https://www.gatsbyjs.org/docs/use-static-query/
 */

import React from 'react';
import { Link, useStaticQuery, graphql } from 'gatsby';
import Image from 'gatsby-image';

import { rhythm } from '../utils/typography';

const Bio = () => {
  const data = useStaticQuery(graphql`
    query BioQuery {
      avatar: file(absolutePath: { regex: "/avatar.jpeg/" }) {
        childImageSharp {
          fixed(width: 50, height: 50) {
            ...GatsbyImageSharpFixed
          }
        }
      }
      site {
        siteMetadata {
          author {
            name
            summary
          }
          social {
            twitter
          }
        }
      }
    }
  `);

  const { author } = data.site.siteMetadata;
  return (
    <div
      style={{
        display: `flex`,
        marginBottom: rhythm(2.5),
      }}
    >
      <Link to={`/`} style={{ boxShadow: 'none', color: 'inherit' }}>
        <Image
          fixed={data.avatar.childImageSharp.fixed}
          alt={author.name}
          style={{
            marginRight: rhythm(1 / 2),
            marginBottom: 0,
            minWidth: 50,
            borderRadius: `100%`,
            cursor: 'pointer',
          }}
          imgStyle={{
            borderRadius: `50%`,
          }}
        />
      </Link>
      <p>
        <strong>持续精进</strong>
        <br />
        <a href="https://github.com/tsejx">Github</a>
      </p>
    </div>
  );
};

export default Bio;
